import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const template = (name: string): string =>
  readFileSync(join(process.cwd(), '..', 'supabase', 'templates', name), 'utf8');

describe('Supabase auth email templates', () => {
  it.each([
    ['confirmation.html', 'CONFIRM MY EMAIL', 'Welcome to Glockery'],
    ['recovery.html', 'RESET MY PASSWORD', 'Reset your password'],
  ])('keeps %s branded, responsive, and connected to the secure action', (file, cta, heading) => {
    const html = template(file);

    expect(html).toContain('{{ .ConfirmationURL }}');
    expect(html).toContain(cta);
    expect(html).toContain(heading);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('max-width:600px');
    expect(html).toContain('GLOCKERY');
    expect(html).not.toContain('<script');
  });
});
