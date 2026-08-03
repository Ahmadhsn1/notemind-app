// Provider selection is decided from env at call time, so these tests mutate
// process.env and re-require the module with a fresh registry entry. The
// alternative — exporting the resolver for injection — would mean the tests
// exercised a different code path than production.
const loadEmail = () => {
  delete require.cache[require.resolve('../services/email')];
  delete require.cache[require.resolve('../config/env')];
  return require('../services/email');
};

const ORIGINAL = { ...process.env };

const setEnv = (vars) => {
  for (const key of ['RESEND_API_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'EMAIL_FROM']) {
    delete process.env[key];
  }
  Object.assign(process.env, vars);
};

afterEach(() => {
  process.env = { ...ORIGINAL };
  delete require.cache[require.resolve('../services/email')];
  delete require.cache[require.resolve('../config/env')];
  vi.restoreAllMocks();
});

describe('email provider selection', () => {
  it('uses Gmail when only Gmail is configured', () => {
    setEnv({ GMAIL_USER: 'notemind@gmail.test', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
    expect(loadEmail().emailProvider()).toBe('gmail');
  });

  it('uses Resend when only Resend is configured', () => {
    setEnv({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'NoteMind <no-reply@notemind.test>' });
    expect(loadEmail().emailProvider()).toBe('resend');
  });

  // A verified domain is strictly better than a personal Gmail account, so if
  // someone has set one up it should win without needing the other removed.
  it('prefers Resend when both are configured', () => {
    setEnv({
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'NoteMind <no-reply@notemind.test>',
      GMAIL_USER: 'notemind@gmail.test',
      GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
    });
    expect(loadEmail().emailProvider()).toBe('resend');
  });

  it('reports unconfigured when neither is set', () => {
    setEnv({});
    const email = loadEmail();
    expect(email.emailProvider()).toBeNull();
    expect(email.isEmailConfigured()).toBe(false);
  });

  // Half-configured Gmail is caught at config load and refuses to boot,
  // rather than quietly degrading to "log instead of send" — which looks
  // identical to working right up until a real user needs a reset.
  it('refuses to boot on a half-configured Gmail setup', () => {
    setEnv({ GMAIL_USER: 'notemind@gmail.test' });
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadEmail()).toThrow('process.exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog.mock.calls.flat().join(' ')).toMatch(/GMAIL_APP_PASSWORD/);
  });

  it('refuses to boot when Resend has a key but no from-address', () => {
    setEnv({ RESEND_API_KEY: 're_test' });
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => loadEmail()).toThrow('process.exit');
    expect(errorLog.mock.calls.flat().join(' ')).toMatch(/EMAIL_FROM/);
  });

  // Google displays app passwords in four space-separated groups; pasting
  // that verbatim is the obvious mistake and otherwise fails with an opaque
  // SMTP auth error.
  it('strips the spaces Google shows in app passwords', () => {
    setEnv({ GMAIL_USER: 'notemind@gmail.test', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
    loadEmail();
    expect(require('../config/env').GMAIL_APP_PASSWORD).toBe('abcdefghijklmnop');
  });
});

describe('sending', () => {
  it('logs instead of sending when unconfigured, and reports it', async () => {
    setEnv({});
    const result = await loadEmail().sendEmail({ to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't' });
    expect(result.delivered).toBe(false);
  });

  it('posts to Resend with the configured from-address', async () => {
    setEnv({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'NoteMind <no-reply@notemind.test>' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, text: async () => '' });

    const result = await loadEmail().sendEmail({ to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't' });

    expect(result.delivered).toBe(true);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(options.body).from).toBe('NoteMind <no-reply@notemind.test>');
    expect(options.headers.Authorization).toBe('Bearer re_test');
  });

  it('surfaces a Resend failure without echoing the provider body to callers', async () => {
    setEnv({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'NoteMind <no-reply@notemind.test>' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 422, text: async () => 'domain not verified' });

    // forgotPassword swallows this so a provider outage can't become an
    // account-existence oracle; it must still be a real throw here so that
    // decision stays deliberate rather than accidental.
    await expect(
      loadEmail().sendEmail({ to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't' })
    ).rejects.toThrow(/422/);
  });

  it('defaults the Gmail from-address to the authenticated account', () => {
    setEnv({ GMAIL_USER: 'notemind@gmail.test', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
    const email = loadEmail();
    expect(email.emailProvider()).toBe('gmail');
    // Gmail rewrites any other from-address, so nothing else would survive
    // delivery anyway.
    expect(require('../config/env').EMAIL_FROM).toBeUndefined();
  });
});
