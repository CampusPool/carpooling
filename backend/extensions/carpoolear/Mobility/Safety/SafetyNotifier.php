<?php

namespace STS\Mobility\Safety;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use STS\Models\User;

final class SafetyNotifier
{
    public function send(User $rider, string $email, string $requestId): void
    {
        $name = str_replace(["\r", "\n"], ' ', (string) $rider->name);
        $phone = \Illuminate\Support\Facades\DB::table('mobility_student_profiles')->where('user_id', $rider->id)->value('phone_e164');
        $text = $name." has indicated that they do not feel safe during a CampusPool ride. Please contact them using your normal channel.\n";
        $text .= "Their CampusPool email: ".$rider->email."\n";
        if ($phone) $text .= "Their profile phone number: ".$phone."\n";
        $text .= "CampusPool does not share live location or contact emergency services automatically.";
        $subject = 'CampusPool: please check on your contact';
        $transport = getenv('MOBILITY_EMAIL_TRANSPORT');
        if ($transport === 'nylas_api') {
            $grant = (string) getenv('MOBILITY_NYLAS_GRANT_ID');
            $response = Http::withToken((string) getenv('MOBILITY_NYLAS_API_KEY'))->asJson()->acceptJson()
                ->connectTimeout(4)->timeout(10)->withHeaders(['Idempotency-Key' => $requestId])
                ->post('https://api.us.nylas.com/v3/grants/'.rawurlencode($grant).'/messages/send', [
                    'to' => [['email' => $email]], 'subject' => $subject, 'body' => $text,
                ]);
            if (!$response->successful() || !is_string($response->json('data.id'))) throw new \RuntimeException('SAFETY_DELIVERY_UNCONFIRMED');
        } elseif ($transport === 'resend_api') {
            $http = Http::withToken((string) getenv('MOBILITY_RESEND_API_KEY'))->asJson()->connectTimeout(4)->timeout(10)
                ->withHeaders(['Idempotency-Key' => $requestId]);
            $proxy = trim((string) getenv('MOBILITY_RESEND_HTTPS_PROXY'));
            if ($proxy !== '') $http = $http->withOptions(['proxy' => $proxy]);
            $response = $http->post('https://api.resend.com/emails', [
                'from' => (string) getenv('MOBILITY_RESEND_FROM'), 'to' => [$email], 'subject' => $subject, 'text' => $text,
            ]);
            if (!$response->successful() || !is_string($response->json('id'))) throw new \RuntimeException('SAFETY_DELIVERY_UNCONFIRMED');
        } else {
            Mail::raw($text, fn ($message) => $message->to($email)->subject($subject));
        }
    }
}
