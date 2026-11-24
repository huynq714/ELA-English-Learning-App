import { useLocalSearchParams } from 'expo-router';

import ReviewSessionScreen from '@/screens/review-session-screen';

export default function ReviewSessionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReviewSessionScreen key={id} sessionId={typeof id === 'string' ? id : ''} />;
}
