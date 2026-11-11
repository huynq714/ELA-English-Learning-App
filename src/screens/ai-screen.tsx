import { StyleSheet, View } from 'react-native';

import { BottomNavigation } from '@/components/bottom-navigation';
import { useDemoNotice } from '@/components/demo-notice';
import { ActivityCard, AppHeader, Asset, Screen } from '@/components/ui';
import { figmaAssets } from '@/theme/figma-assets';

const assets = figmaAssets.ai;

export default function AiScreen() {
  const notice = useDemoNotice();
  return <Screen testID="screen-ai" header={<AppHeader title="AI Conversation" />}
    footer={<BottomNavigation active="ai" />} contentStyle={styles.content}>
    <ActivityCard title="Free Talk" subtitle="Trò chuyện tự do với AI" icon={assets.messageSquare}
      chevron={assets.chevronRight} onPress={() => notice('Hội thoại Free Talk')} />
    <ActivityCard title="Roleplay" subtitle="Luyện giao tiếp qua các tình huống" icon={assets.usersRound}
      chevron={assets.chevronRight} onPress={() => notice('Hội thoại Roleplay')} />
    <View style={styles.assistant}>
      <Asset source={assets.aiAssistantIllustration} width={230} height={180} label="Robot trợ lý hội thoại AI" />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 22, paddingHorizontal: 23, paddingBottom: 24, gap: 24 },
  assistant: { alignItems: 'center', paddingTop: 22 },
});
