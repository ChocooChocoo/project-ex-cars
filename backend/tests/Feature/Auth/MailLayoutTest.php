<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Mail\Markdown;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MailLayoutTest extends TestCase
{
    #[Test]
    public function email_header_links_to_the_frontend_not_the_api(): void
    {
        config(['app.url' => 'https://api.example.test', 'app.frontend_url' => 'https://www.example.test']);

        $mail = (new ResetPassword('tok'))->toMail(new User(['email' => 'buyer@example.test']));
        $html = (string) $mail->render();
        $text = (string) app(Markdown::class)->renderText($mail->markdown, $mail->data());

        $this->assertStringContainsString('href="https://www.example.test"', $html);
        $this->assertStringNotContainsString('https://api.example.test', $html);
        $this->assertStringNotContainsString('https://api.example.test', $text);
    }
}
