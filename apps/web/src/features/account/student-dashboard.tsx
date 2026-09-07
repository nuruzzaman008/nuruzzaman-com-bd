import Link from 'next/link';
import type { Enrollment } from '@nuruzzaman/contracts';
import { Card } from '@/components/ui/card';

export function StudentDashboard({ name, enrollments, locale }: { name: string; enrollments: Enrollment[]; locale: string }) {
  const bn = locale === 'bn';
  const active = enrollments.filter((item) => item.status === 'active' || item.status === 'completed');
  const completed = active.filter((item) => item.status === 'completed');
  return <div className="space-y-8">
    <header className="rounded-2xl bg-navy p-6 text-white sm:p-8">
      <p className="text-sm font-semibold text-white/70">STUDENT • LEARNING MANAGEMENT SYSTEM</p>
      <h1 className="mt-3 text-3xl font-bold">{bn ? `স্বাগতম, ${name}` : `Welcome, ${name}`}</h1>
      <p className="mt-3 text-white/80">{bn ? 'আপনার শেখার জায়গা—ভিডিও ক্লাস, পাঠের ফাইল, অনুশীলন ও অগ্রগতি একসঙ্গে।' : 'Your learning space for video lessons, resources, practice and progress.'}</p>
      <Link href="/courses" className="mt-5 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-navy">{bn ? 'কোর্স খুঁজুন' : 'Explore courses'}</Link>
    </header>
    <div className="grid gap-4 sm:grid-cols-3">{[
      [bn ? 'আমার কোর্স' : 'My courses', enrollments.length],
      [bn ? 'সম্পন্ন কোর্স' : 'Completed courses', completed.length],
      [bn ? 'সার্টিফিকেট' : 'Certificates', active.filter((item) => item.certificate_id).length],
    ].map(([title, value]) => <Card key={title} className="p-5"><p className="text-sm text-muted">{title}</p><p className="mt-2 text-3xl font-bold text-navy">{value}</p></Card>)}</div>
    <section>
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-navy">{bn ? 'শেখা চালিয়ে যান' : 'Continue learning'}</h2><Link href="/account/courses" className="text-sm text-blue">{bn ? 'সব কোর্স' : 'All courses'} →</Link></div>
      {active.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{active.map((item) => <Card key={item.id} className="p-5">
        <h3 className="font-bold text-navy">{item.course.title}</h3>
        <p className="mt-3 text-sm text-muted">{item.progress_percent}% {bn ? 'সম্পন্ন' : 'complete'}</p>
        <progress className="mt-2 h-2 w-full accent-blue" value={item.progress_percent} max={100} aria-label={item.course.title} />
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-blue" href={`/learn/${item.course.slug}`}>{bn ? 'ক্লাস খুলুন' : 'Open lessons'} →</Link><Link className="text-blue" href={`/account/courses/${item.course.slug}`}>{bn ? 'ফলাফল, নোট ও আলোচনা' : 'Results, notes and discussion'}</Link></div>
      </Card>)}</div> : <Card className="mt-4 p-6"><h3 className="font-bold text-navy">{bn ? 'আপনার শেখার যাত্রা শুরু করুন' : 'Start your learning journey'}</h3><p className="mt-2 text-muted">{bn ? 'কোর্সে ভর্তি হলে এখানে আপনার ক্লাস ও অগ্রগতি দেখা যাবে।' : 'Your lessons and progress will appear here after enrollment.'}</p><Link href="/courses" className="mt-4 inline-block font-semibold text-blue">{bn ? 'কোর্স দেখুন' : 'Browse courses'} →</Link></Card>}
    </section>
  </div>;
}
