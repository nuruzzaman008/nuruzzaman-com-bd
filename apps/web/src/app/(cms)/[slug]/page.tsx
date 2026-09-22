import View from './view';
export { generateMetadata } from './view';

export default function Page(props: { params: Promise<{ slug: string }> }) {
  return <View {...props} />;
}
