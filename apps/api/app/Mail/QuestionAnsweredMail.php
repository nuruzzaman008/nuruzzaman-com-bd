<?php

namespace App\Mail;

use App\Models\CourseQuestion;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Tells a student their question has an answer, and where to read it. */
class QuestionAnsweredMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly CourseQuestion $question,
        public readonly string $answeredBy,
        public readonly string $answer,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your question has an answer');
    }

    public function content(): Content
    {
        $site = config('nb.site');
        $course = $this->question->course;
        $lesson = $this->question->lesson;
        $base = rtrim((string) $site['url'], '/');

        return new Content(markdown: 'mail.question-answered', with: [
            'question' => $this->question,
            'answeredBy' => $this->answeredBy,
            'answer' => $this->answer,
            'site' => $site,
            'where' => $lesson ? $course->title.' - '.$lesson->title : $course->title,
            // Read where it was asked: under the lesson, else on the course page.
            'url' => $lesson
                ? $base.'/learn/'.rawurlencode($course->slug).'/'.rawurlencode($lesson->slug)
                : $base.'/account/courses/'.rawurlencode($course->slug),
        ]);
    }
}
