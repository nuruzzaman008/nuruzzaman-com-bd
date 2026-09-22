import {
  Banknote,
  Bell,
  GraduationCap,
  KeyRound,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageCircleQuestionMark,
  MessageSquare,
  ShieldAlert,
  ShoppingCart,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

type Badge = { icon: LucideIcon; className: string };

const BY_TYPE: Record<string, Badge> = {
  'order.paid': { icon: ShoppingCart, className: 'bg-emerald-600' },
  'order.confirmed': { icon: ShoppingCart, className: 'bg-emerald-600' },
  'payment.submitted': { icon: Banknote, className: 'bg-blue' },
  'activation.requested': { icon: KeyRound, className: 'bg-violet-600' },
  'activation.updated': { icon: KeyRound, className: 'bg-violet-600' },
  'ticket.opened': { icon: LifeBuoy, className: 'bg-cyan-700' },
  'ticket.customer_replied': { icon: LifeBuoy, className: 'bg-cyan-700' },
  'ticket.staff_replied': { icon: LifeBuoy, className: 'bg-cyan-700' },
  'contact.received': { icon: Mail, className: 'bg-teal-700' },
  'question.asked': { icon: MessageCircleQuestionMark, className: 'bg-amber-600' },
  'question.answered': { icon: MessageCircleQuestionMark, className: 'bg-amber-600' },
  'course.announcement': { icon: Megaphone, className: 'bg-amber-600' },
  'comment.pending': { icon: MessageSquare, className: 'bg-rose-600' },
  'user.registered': { icon: UserPlus, className: 'bg-indigo-600' },
  'affiliate.joined': { icon: UserPlus, className: 'bg-indigo-600' },
  'security.lockout': { icon: ShieldAlert, className: 'bg-red-600' },
};

const BY_KIND: Record<string, Badge> = {
  ticket: { icon: LifeBuoy, className: 'bg-cyan-700' },
  contact: { icon: Mail, className: 'bg-teal-700' },
  question: { icon: GraduationCap, className: 'bg-amber-600' },
  comment: { icon: MessageSquare, className: 'bg-rose-600' },
};

/** The little coloured icon on a notification's avatar. */
export function badgeForType(type: string): Badge {
  return BY_TYPE[type] ?? { icon: Bell, className: 'bg-navy' };
}

/** The same, for a conversation in the message list. */
export function badgeForKind(kind: string): Badge {
  return BY_KIND[kind] ?? { icon: MessageSquare, className: 'bg-navy' };
}
