import View, { generateMetadata as viewMetadata } from './view';

export function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  return viewMetadata(props);
}

export default function Page(props: { params: Promise<{ slug: string }> }) {
  return <View {...props} />;
}
