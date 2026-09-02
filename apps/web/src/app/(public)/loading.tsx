import { Container } from '@/components/ui/container';
import { LoadingRegion } from '@/components/ui/states';

export default function Loading() {
  return (
    <Container className="py-16">
      <LoadingRegion />
    </Container>
  );
}
