import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';

// Every number HYDRA puts on screen comes from published physiology, and the
// user is entitled to check it — App Store guideline 1.4.1 requires health and
// medical information to carry findable citations. Each block below names the
// coefficient the engine actually uses (see src/engine/hydrationEngine.ts) and
// links to the paper it comes from. Keep the two in step: if a coefficient
// changes, its citation changes here in the same commit.

interface Reference {
  /** Short label shown on the tappable link. */
  label: string;
  /** Full citation, so it stays traceable even offline / if a link rots. */
  citation: string;
  url: string;
}

interface Topic {
  title: string;
  /** What HYDRA does with it, in plain French. */
  what: string;
  refs: Reference[];
}

const TOPICS: Topic[] = [
  {
    title: 'BESOIN QUOTIDIEN — 32 mL/kg',
    what:
      "HYDRA fixe ta cible d'eau à 32 mL par kilo de poids corporel, la valeur médiane de la fourchette clinique de 30–35 mL/kg, cohérente avec les apports de référence européens une fois l'eau des aliments prise en compte.",
    refs: [
      {
        label: 'EFSA 2010 — Apports de référence pour l’eau',
        citation:
          'EFSA Panel on Dietetic Products, Nutrition and Allergies (2010). Scientific Opinion on Dietary Reference Values for water. EFSA Journal 8(3):1459.',
        url: 'https://doi.org/10.2903/j.efsa.2010.1459',
      },
      {
        label: 'Jéquier & Constant 2010 — Bases physiologiques',
        citation:
          'Jéquier E, Constant F (2010). Water as an essential nutrient: the physiological basis of hydration. European Journal of Clinical Nutrition 64(2):115–123.',
        url: 'https://doi.org/10.1038/ejcn.2009.111',
      },
    ],
  },
  {
    title: 'PLAFOND D’ABSORPTION — ~1 L PAR HEURE',
    what:
      "Boire un litre d'un coup n'hydrate pas plus vite que boire par gorgées : au-delà d'environ 1 L par heure glissante, l'excédent est excrété. HYDRA ne crédite donc la barre que jusqu'à ce plafond — c'est aussi pour ça que les boutons se bloquent quand tu es saturé.",
    refs: [
      {
        label: 'Jéquier & Constant 2010 — Clairance rénale de l’eau libre',
        citation:
          'Jéquier E, Constant F (2010). Water as an essential nutrient: the physiological basis of hydration. European Journal of Clinical Nutrition 64(2):115–123.',
        url: 'https://doi.org/10.1038/ejcn.2009.111',
      },
    ],
  },
  {
    title: 'ALCOOL — LA DIURÈSE',
    what:
      "Chaque gramme d'éthanol fait éliminer environ 10 mL d'urine supplémentaires. HYDRA convertit le volume et le degré du verre en grammes d'éthanol, puis applique cette perte.",
    refs: [
      {
        label: 'Eggleton 1942 — J. Physiol.',
        citation:
          'Eggleton MG (1942). The diuretic action of alcohol in man. The Journal of Physiology 101(2):172–191.',
        url: 'https://doi.org/10.1113/jphysiol.1942.sp003973',
      },
    ],
  },
  {
    title: 'ALCOOL — LE DEGRÉ COMPTE PLUS QUE LE VOLUME',
    what:
      "À dose d'éthanol égale, une bière (5°) ne produit pas de diurèse mesurable alors qu'un vin (13,5°) ou un spiritueux en produit une. HYDRA applique donc un facteur de concentration : 0,3 en dessous de 8°, jusqu'à 1,0 à partir de 20°. Une bière légère pèse réellement moins lourd qu'un shot de grammes équivalents.",
    refs: [
      {
        label: 'Polhuis et al. 2017 — Nutrients',
        citation:
          'Polhuis KCMM, Wijnen AHC, Sierksma A, Calame W, Tieland M (2017). The Diuretic Action of Weak and Strong Alcoholic Beverages in Elderly Men: A Randomized Diet-Controlled Crossover Trial. Nutrients 9(7):660.',
        url: 'https://doi.org/10.3390/nu9070660',
      },
      {
        label: 'Maughan et al. 2016 — Beverage Hydration Index',
        citation:
          'Maughan RJ, Watson P, Cordery PAA, Walsh NP, Oliver SJ, Dolci A, Rodriguez-Sanchez N, Galloway SDR (2016). A randomized trial to assess the potential of different beverages to affect hydration status: development of a beverage hydration index. American Journal of Clinical Nutrition 103(3):717–723.',
        url: 'https://doi.org/10.3945/ajcn.115.114769',
      },
    ],
  },
  {
    title: 'SPORT — LA SUEUR',
    what:
      "La sueur suit la chaleur métabolique produite, donc la masse corporelle × l'intensité de l'effort, puis elle est modulée par la température et l'humidité. HYDRA part de 1,43 mL par MET·kg·h — calibré pour qu'un homme de 70 kg à 8 METs en conditions tempérées perde ≈ 800 mL/h. L'écart hommes/femmes venant surtout de la masse, il ne reste qu'un facteur résiduel de 0,9.",
    refs: [
      {
        label: 'Cramer & Jay 2016 — Thermorégulation',
        citation:
          'Cramer MN, Jay O (2016). Biophysical aspects of human thermoregulation during heat stress. Autonomic Neuroscience 196:3–13.',
        url: 'https://doi.org/10.1016/j.autneu.2016.03.001',
      },
      {
        label: 'Baker 2017 — Sports Medicine',
        citation:
          'Baker LB (2017). Sweating Rate and Sweat Sodium Concentration in Athletes: A Review of Methodology and Intra/Interindividual Variability. Sports Medicine 47(Suppl 1):111–128.',
        url: 'https://doi.org/10.1007/s40279-017-0691-5',
      },
    ],
  },
  {
    title: 'CAFÉ — PAS DÉSHYDRATANT À DOSE MODÉRÉE',
    what:
      "Contrairement à l'idée reçue, un café normal compte comme de l'eau : aucune déshydratation mesurable à consommation modérée. HYDRA ne retire de l'eau qu'au-delà de 500 mg de caféine.",
    refs: [
      {
        label: 'Killer et al. 2014 — PLoS ONE',
        citation:
          'Killer SC, Blannin AK, Jeukendrup AE (2014). No Evidence of Dehydration with Moderate Daily Coffee Intake: A Counterbalanced Cross-Over Study in a Free-Living Population. PLoS ONE 9(1):e84154.',
        url: 'https://doi.org/10.1371/journal.pone.0084154',
      },
    ],
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SourcesSheet({ visible, onClose }: Props) {
  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 28 }}>
            <Text style={styles.title}>SOURCES SCIENTIFIQUES</Text>
            <Text style={styles.intro}>
              HYDRA n’est pas un dispositif médical et ne pose aucun diagnostic.
              La barre est une estimation calculée à partir de coefficients
              publiés, qui sont des moyennes de population : ton corps peut s’en
              écarter. Pour tout besoin d’hydratation spécifique — grossesse,
              maladie rénale ou cardiaque, traitement diurétique, sport
              d’endurance encadré — parles-en à un professionnel de santé.
            </Text>

            {TOPICS.map((t) => (
              <View key={t.title} style={styles.topic}>
                <Text style={styles.topicTitle}>{t.title}</Text>
                <Text style={styles.topicWhat}>{t.what}</Text>
                {t.refs.map((r) => (
                  <View key={r.url + r.label} style={styles.ref}>
                    <Text style={styles.citation}>{r.citation}</Text>
                    <Pressable onPress={() => open(r.url)} hitSlop={8}>
                      <Text style={styles.link}>{r.label} ↗</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}

            <Text style={styles.note}>
              Les liens ouvrent la publication d’origine (DOI). Le détail des
              formules est également documenté dans le code du moteur de calcul.
            </Text>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeTxt}>FERMER</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.bgSoft,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: C.segmentEmpty,
    maxHeight: '92%',
  },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 20,
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  intro: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  topic: { marginTop: 22 },
  topicTitle: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 12.5,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  topicWhat: {
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  ref: {
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: C.segmentEmpty,
  },
  citation: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    lineHeight: 15,
  },
  link: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 11.5,
    letterSpacing: 0.5,
    marginTop: 5,
    textDecorationLine: 'underline',
  },
  note: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 26,
  },
  closeBtn: {
    backgroundColor: C.segmentFull,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  closeTxt: {
    color: C.bg,
    fontFamily: FONTS.display,
    letterSpacing: 3,
    fontSize: 14,
  },
});
