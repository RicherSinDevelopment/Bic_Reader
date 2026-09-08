import { LockKeyhole, Sparkles } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type PremiumFeatureModalProps = {
  description: string;
  featureName: string;
  onClose: () => void;
  onUpgrade: () => void;
  onSignIn?: () => void;
  visible: boolean;
};

export default function PremiumFeatureModal({
  description,
  featureName,
  onClose,
  onUpgrade,
  onSignIn,
  visible,
}: PremiumFeatureModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.container}>
        <Pressable accessibilityLabel="Close Premium message" onPress={onClose} style={styles.backdrop} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <LockKeyhole color="#639922" size={25} strokeWidth={2.1} />
          </View>
          <Text style={styles.eyebrow}>BIC READER PREMIUM</Text>
          <Text style={styles.title}>{featureName}</Text>
          <Text style={styles.description}>{description}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={onUpgrade}
            style={({ pressed }) => [styles.upgradeButton, pressed && styles.buttonPressed]}
          >
            <Sparkles color="#FFFFFF" size={18} />
            <Text style={styles.upgradeText}>Upgrade to Premium</Text>
          </Pressable>
          {onSignIn ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSignIn}
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.notNowButton}>
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(19, 24, 17, 0.48)' },
  card: { width: '100%', maxWidth: 370, borderWidth: 1, borderColor: '#E0E4D8', borderRadius: 25, alignItems: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 15, backgroundColor: '#FFFEFA', shadowColor: '#11180C', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 12 },
  iconWrap: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECF4E1' },
  eyebrow: { marginTop: 15, color: '#6A8F3D', fontFamily: 'Lato_700Bold', fontSize: 10, letterSpacing: 1.2 },
  title: { marginTop: 6, textAlign: 'center', color: '#20251D', fontFamily: 'Lato_700Bold', fontSize: 23, lineHeight: 28 },
  description: { maxWidth: 300, marginTop: 9, textAlign: 'center', color: '#677060', fontFamily: 'SourceSans3_400Regular', fontSize: 15, lineHeight: 21 },
  upgradeButton: { width: '100%', height: 53, marginTop: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#639922' },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  upgradeText: { color: '#FFFFFF', fontFamily: 'Lato_700Bold', fontSize: 16 },
  signInButton: { width: '100%', minHeight: 46, marginTop: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CAD8BB', borderRadius: 15, backgroundColor: '#F5F8F0' },
  signInText: { color: '#4F7D1A', fontFamily: 'Lato_700Bold', fontSize: 15 },
  notNowButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  notNowText: { color: '#66705E', fontFamily: 'Lato_700Bold', fontSize: 14 },
});
