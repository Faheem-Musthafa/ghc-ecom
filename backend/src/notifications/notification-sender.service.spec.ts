import { BadGatewayException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { NotificationSenderService } from './notification-sender.service';

describe('NotificationSenderService', () => {
  const configValues: Record<string, unknown> = {
    EMAIL_FROM: 'Glockery Home Centre <orders@example.com>',
    RESEND_API_KEY: 're_test_key',
    OUTBOUND_TIMEOUT_MS: 10_000,
  };
  const config = {
    getOrThrow: jest.fn((key: string) => configValues[key]),
    get: jest.fn((key: string) => configValues[key]),
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends email through the Resend HTTPS API with an idempotency key', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }));
    const sender = new NotificationSenderService(config as never);

    await expect(
      sender.send({
        channel: NotificationChannel.EMAIL,
        recipient: 'customer@example.com',
        subject: 'Order confirmed',
        text: 'Your order is confirmed.',
        html: '<p>Your order is confirmed.</p>',
        idempotencyKey: 'notification-123',
      }),
    ).resolves.toBe('email-id');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer re_test_key',
          'content-type': 'application/json',
          'idempotency-key': 'notification-123',
        }),
      }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      from: 'Glockery Home Centre <orders@example.com>',
      to: ['customer@example.com'],
      subject: 'Order confirmed',
      text: 'Your order is confirmed.',
      html: '<p>Your order is confirmed.</p>',
    });
  });

  it('surfaces a safe provider status when Resend rejects the request', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Domain is not verified' }), { status: 403 }),
      );
    const sender = new NotificationSenderService(config as never);

    await expect(
      sender.send({
        channel: NotificationChannel.EMAIL,
        recipient: 'customer@example.com',
        subject: 'Order confirmed',
        text: 'Your order is confirmed.',
        idempotencyKey: 'notification-123',
      }),
    ).rejects.toThrow(new BadGatewayException('EMAIL notification provider returned 403'));
  });
});
