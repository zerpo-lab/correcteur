/**
 * Les tests de la logique de correction.
 *
 *     node --experimental-strip-types tests/logique.test.ts
 *
 * Ils portent sur le bloc « logique » de `hooks/register.tsx`, extrait tel quel
 * à l'exécution : c'est donc le code qui tourne qui est testé, jamais une copie.
 * Tout ce qui demande le moteur — le dessin, l'appel au modèle, les réglages —
 * n'est pas ici : ces fonctions-là sont pures et c'est là que sont les pièges.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(ici, '..', 'hooks', 'register.tsx'), 'utf8')
const debut = source.indexOf('// --- logique: début')
const fin = source.indexOf('// --- logique: fin')
if (debut < 0 || fin < 0) {
  console.error("les repères du bloc « logique » ont disparu de register.tsx")
  process.exit(1)
}
const bloc = join(mkdtempSync(join(tmpdir(), 'correcteur-')), 'logique.ts')
writeFileSync(bloc, source.slice(debut, fin))

const { PERSO, aligne, corrigible, dernier, mots, protege } = await import(bloc)

let echecs = 0
const dit = (nom: string, vrai: boolean) => {
  if (!vrai) echecs++
  console.log((vrai ? '  ok      ' : '  ÉCHEC   ') + nom)
}

/** La découpe telle qu'elle serait dessinée, les mots teintés entre crochets. */
function rendu(orig: string, corr: string): string {
  dernier.refus = ''
  const v = aligne(orig, corr)
  if (!v) return 'REFUSÉE: ' + dernier.refus
  const marque = new Map<number, boolean>()
  v.places.forEach((p: number, k: number) => marque.set(p, v.neuf[k]))
  return v.bouts.map((b: string, i: number) => (marque.get(i) ? '[' + b + ']' : b)).join('')
}

console.log('\n— ce qui doit être corrigé —')
dit(
  'accents, accords et traits d\'union',
  rendu(
    "attends. renseigne toi et dis moi ce qui est possible. de ce que je lis ca consommerai de l'haiku.",
    "attends. renseigne-toi et dis-moi ce qui est possible. de ce que je lis ça consommerait de l'haiku.",
  ) ===
    "attends. [renseigne-toi] et [dis-moi] ce qui est possible. de ce que je lis [ça] [consommerait] de l'haiku.",
)
dit(
  'un mot coupé en deux',
  rendu("est-ce qu'iln'y a pas un process", "est-ce qu'il n'y a pas un process") ===
    "est-ce [qu'il] [n'y] a pas un process",
)
dit('un message de deux mots', rendu('ca marche', 'ça marche') === '[ça] marche')
dit('un message d\'un seul mot', rendu('etude', 'étude') === '[étude]')
dit(
  'la partie française seule, dans une demande de traduction',
  rendu(
    'traduis ca stp : the frames are delivered with the tpu kit',
    'traduis ça stp : the frames are delivered with the tpu kit',
  ) === 'traduis [ça] stp : the frames are delivered with the tpu kit',
)

console.log('\n— ce qui doit être refusé —')
const refuse = (nom: string, o: string, c: string, motif: string) => {
  dernier.refus = ''
  const v = aligne(o, c)
  dit(nom + ' → ' + dernier.refus, v === null && dernier.refus.startsWith(motif))
}
refuse('une clause perdue', 'ca marche. enfin je voudrais voir une phrasee longe',
  'enfin je voudrais voir une phrase longue', 'écart de longueur')
refuse('un mot retiré', 'je voudrais bien voir ca sur une phrase longe',
  'je voudrais voir ça sur une phrase longue', 'mot perdu')
refuse('un mot protégé déformé', 'je shoote des bando ce week-end.',
  'je shoote des bandeau ce week-end.', 'mot protégé')
refuse('une réécriture de style', "ca me semble bien plus clair que tout ce qu'on a.",
  "Cela me paraît considérablement plus lisible que l'ensemble de nos écrans.", 'écart de longueur')
refuse('trop de mots changés d\'un coup', 'tu an panse coua ?', 'tu en penses quoi ?', 'réécriture')
refuse('une ponctuation ajoutée', 'bon je crois que ca suffit',
  'bon, je crois que ça suffit !', 'réécriture')
refuse('une phrase sans faute', 'tout va bien ici.', 'tout va bien ici.', 'aucune faute')

console.log('\n— la casse est annulée, pas affichée —')
dit(
  'une majuscule ajoutée revient en minuscule',
  rendu('bon je crois que ca suffit', 'Bon je crois que ça suffit') === 'bon je crois que [ça] suffit',
)
dit(
  'un nom propre gardé tel qu\'il a été tapé',
  rendu('araignée et arthur etaient la', 'Araignée et Arthur étaient là') ===
    'araignée et arthur [étaient] [là]',
)

console.log('\n— ce qui ne part jamais chez le correcteur —')
dit('une commande', !corrigible('/correcteur'))
dit('un appel système', !corrigible('<channel foo>'))
dit('du JSON', !corrigible('{"a":1}'))
dit('un bloc de code', !corrigible('voici ```du code``` a corriger'))
dit('un collage de plus de 600 caractères', !corrigible('a'.repeat(700)))
dit('une phrase ordinaire, elle, passe', corrigible('ca peut etre genant a force.'))

console.log('\n— les mots protégés —')
dit('les majuscules', protege('ACME'))
dit('les mots avec un chiffre', protege('99.2%') && protege('v2'))
dit('les chemins', protege('src/app.ts'))
dit('la liste livrée', protege('fpv') && protege('lipo') && protege('bando'))
dit('un mot ordinaire ne l\'est pas', !protege('creation') && !protege('etre'))
PERSO.add('doohde')
dit('un mot ajouté par la personne', protege('doohde') && protege('Doohde'))
PERSO.delete('doohde')
dit('et retiré, il ne l\'est plus', !protege('doohde'))

console.log('\n— la découpe en mots —')
dit('les espaces multiples', mots('a   b\n\nc').length === 3)

console.log(echecs ? '\n' + echecs + ' ÉCHEC(S)\n' : '\ntout passe\n')
process.exit(echecs ? 1 : 0)
