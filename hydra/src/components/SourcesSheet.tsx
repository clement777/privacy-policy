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
import { StringKey, useT } from '../i18n';

// Every number HYDRA puts on screen comes from published physiology, and the
// user is entitled to check it — App Store guideline 1.4.1 requires health and
// medical information to carry findable citations. Each block below names the
// coefficient the engine actually uses (see src/engine/hydrationEngine.ts) and
// links to the paper it comes from. Keep the two in step: if a coefficient
// changes, its citation changes here in the same commit.

interface Reference {
  /** Clé du libellé court affiché sur le lien. */
  label: StringKey;
  /** Citation complète. Volontairement NON traduite : c'est la référence
   *  bibliographique exacte de la publication, qui est en anglais et doit
   *  rester citable telle quelle dans les deux langues. */
  citation: string;
  url: string;
}

interface Topic {
  title: StringKey;
  /** Ce que HYDRA en fait, en clair. */
  what: StringKey;
  refs: Reference[];
}

const TOPICS: Topic[] = [
  {
    title: 'src.need.title',
    what: 'src.need.what',
    refs: [
      {
        label: 'src.need.ref1',
        citation:
          'EFSA Panel on Dietetic Products, Nutrition and Allergies (2010). Scientific Opinion on Dietary Reference Values for water. EFSA Journal 8(3):1459.',
        url: 'https://doi.org/10.2903/j.efsa.2010.1459',
      },
      {
        label: 'src.need.ref2',
        citation:
          'Jéquier E, Constant F (2010). Water as an essential nutrient: the physiological basis of hydration. European Journal of Clinical Nutrition 64(2):115–123.',
        url: 'https://doi.org/10.1038/ejcn.2009.111',
      },
    ],
  },
  {
    title: 'src.absorb.title',
    what: 'src.absorb.what',
    refs: [
      {
        label: 'src.absorb.ref1',
        citation:
          'Jéquier E, Constant F (2010). Water as an essential nutrient: the physiological basis of hydration. European Journal of Clinical Nutrition 64(2):115–123.',
        url: 'https://doi.org/10.1038/ejcn.2009.111',
      },
    ],
  },
  {
    title: 'src.diuresis.title',
    what: 'src.diuresis.what',
    refs: [
      {
        label: 'src.diuresis.ref1',
        citation:
          'Eggleton MG (1942). The diuretic action of alcohol in man. The Journal of Physiology 101(2):172–191.',
        url: 'https://doi.org/10.1113/jphysiol.1942.sp003973',
      },
    ],
  },
  {
    title: 'src.abv.title',
    what: 'src.abv.what',
    refs: [
      {
        label: 'src.abv.ref1',
        citation:
          'Polhuis KCMM, Wijnen AHC, Sierksma A, Calame W, Tieland M (2017). The Diuretic Action of Weak and Strong Alcoholic Beverages in Elderly Men: A Randomized Diet-Controlled Crossover Trial. Nutrients 9(7):660.',
        url: 'https://doi.org/10.3390/nu9070660',
      },
      {
        label: 'src.abv.ref2',
        citation:
          'Maughan RJ, Watson P, Cordery PAA, Walsh NP, Oliver SJ, Dolci A, Rodriguez-Sanchez N, Galloway SDR (2016). A randomized trial to assess the potential of different beverages to affect hydration status: development of a beverage hydration index. American Journal of Clinical Nutrition 103(3):717–723.',
        url: 'https://doi.org/10.3945/ajcn.115.114769',
      },
    ],
  },
  {
    title: 'src.sweat.title',
    what: 'src.sweat.what',
    refs: [
      {
        label: 'src.sweat.ref1',
        citation:
          'Cramer MN, Jay O (2016). Biophysical aspects of human thermoregulation during heat stress. Autonomic Neuroscience 196:3–13.',
        url: 'https://doi.org/10.1016/j.autneu.2016.03.001',
      },
      {
        label: 'src.sweat.ref2',
        citation:
          'Baker LB (2017). Sweating Rate and Sweat Sodium Concentration in Athletes: A Review of Methodology and Intra/Interindividual Variability. Sports Medicine 47(Suppl 1):111–128.',
        url: 'https://doi.org/10.1007/s40279-017-0691-5',
      },
    ],
  },
  {
    title: 'src.coffee.title',
    what: 'src.coffee.what',
    refs: [
      {
        label: 'src.coffee.ref1',
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
  const tr = useT();
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
            <Text style={styles.title}>{tr('src.title')}</Text>
            <Text style={styles.intro}>{tr('src.intro')}</Text>

            {TOPICS.map((topic) => (
              <View key={topic.title} style={styles.topic}>
                <Text style={styles.topicTitle}>{tr(topic.title)}</Text>
                <Text style={styles.topicWhat}>{tr(topic.what)}</Text>
                {topic.refs.map((r) => (
                  <View key={r.url + r.label} style={styles.ref}>
                    <Text style={styles.citation}>{r.citation}</Text>
                    <Pressable onPress={() => open(r.url)} hitSlop={8}>
                      <Text style={styles.link}>{tr(r.label)} ↗</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}

            <Text style={styles.note}>{tr('src.note')}</Text>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeTxt}>{tr('common.close')}</Text>
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
