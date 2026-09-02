import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox, ErrorSummary, Field, Input } from '@/components/ui/form';

describe('Field', () => {
  it('links its label, hint and error to the control', () => {
    render(
      <Field label="ইমেইল" hint="আমরা স্প্যাম পাঠাই না" error="ইমেইলটি বৈধ নয়" required>
        {(props) => <Input name="email" {...props} />}
      </Field>,
    );

    const input = screen.getByLabelText(/ইমেইল/);

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/স্প্যাম/);
    expect(input).toHaveAccessibleDescription(/বৈধ নয়/);
  });

  it('announces a required field to assistive technology, not only with an asterisk', () => {
    render(
      <Field label="নাম" required>
        {(props) => <Input name="name" {...props} />}
      </Field>,
    );

    expect(screen.getByText('(আবশ্যক)')).toBeInTheDocument();
  });
});

describe('ErrorSummary', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = render(<ErrorSummary errors={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('announces the first message per field in an alert', () => {
    render(<ErrorSummary errors={{ email: ['ইমেইল দিন', 'দ্বিতীয়'], name: 'নাম দিন' }} />);

    const alert = screen.getByRole('alert');

    expect(alert).toHaveTextContent('ইমেইল দিন');
    expect(alert).toHaveTextContent('নাম দিন');
    expect(alert).not.toHaveTextContent('দ্বিতীয়');
  });
});

describe('Checkbox', () => {
  it('associates its label with the input', () => {
    render(<Checkbox name="accepts_terms" label="আমি শর্তাবলি মেনে নিচ্ছি" />);

    expect(screen.getByLabelText('আমি শর্তাবলি মেনে নিচ্ছি')).toBeInTheDocument();
  });
});
