<?php

namespace STS\Mobility\Identity;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CollegeEmailAuthController
{
    public function __construct(private CollegeEmailAuth $auth) {}
    public function config(): JsonResponse { return $this->json(['domains' => $this->auth->domains(), 'campuses' => $this->auth->campuses(), 'delivery_available' => $this->auth->deliveryAvailable(), 'delivery_scope' => $this->auth->deliveryScope(), 'demo_available' => \STS\Mobility\Commute\CommuteService::demoEnabled() && ! StudentIdentityBoundary::publicMode(), 'student_only' => StudentIdentityBoundary::publicMode()]); }
    public function requestCode(Request $request): JsonResponse
    {
        $email = $this->auth->normalizeEmail($request->input('email'));
        if (! $email) return $this->error('COLLEGE_EMAIL_INVALID', 422);
        try { return $this->json($this->auth->request($email, $request->ip()), 201); } catch (CollegeEmailAuthException $e) { return $this->error($e->machineCode, $e->httpStatus, $e->meta); }
    }
    public function verify(Request $request): JsonResponse
    {
        $challenge = $request->input('challenge_id'); $code = $request->input('code');
        if (! is_string($challenge) || ! preg_match('/^[0-9a-f-]{36}$/iD', $challenge) || ! is_string($code) || ! preg_match('/^[0-9]{6}$/D', $code)) return $this->error('COLLEGE_OTP_INPUT_INVALID', 422);
        $registration = ['name' => $request->input('name'), 'srn' => $request->input('srn'), 'campus_code' => $request->input('campus_code'), 'gender_identity' => $request->input('gender_identity'), 'phone' => $request->input('phone')];
        try { $this->auth->consumeRate([['verify-ip:'.($request->ip()?:'unknown'),30]],60); return $this->json($this->auth->verify($challenge, $code, $registration)); } catch (CollegeEmailAuthException $e) { return $this->error($e->machineCode, $e->httpStatus, $e->meta); }
    }
    public function studentProfile(Request $request, StudentProfile $profile): JsonResponse
    {
        try { return $this->json($profile->read($request->user('api'))); }
        catch (CollegeEmailAuthException $e) { return $this->error($e->machineCode, $e->httpStatus); }
    }
    public function updateStudentProfile(Request $request, StudentProfile $profile): JsonResponse
    {
        try { return $this->json($profile->update($request->user('api'), $request->only(['name', 'gender_identity', 'phone']))); }
        catch (CollegeEmailAuthException $e) { return $this->error($e->machineCode, $e->httpStatus); }
    }
    public function restoreBrowser(Request $request, StudentBrowserSession $sessions): JsonResponse
    {
        try { return $this->json(['token' => $sessions->restore($request->header('X-CampusPool-Browser-Session'))]); }
        catch (CollegeEmailAuthException $e) { return $this->error($e->machineCode, $e->httpStatus); }
    }
    public function forgetBrowser(Request $request, StudentBrowserSession $sessions): JsonResponse
    {
        $sessions->revoke($request->header('X-CampusPool-Browser-Session'));
        return $this->json(['logged_out' => true]);
    }
    public function logout(Request $request): JsonResponse
    {
        auth('api')->logout();
        return $this->json(['logged_out' => true]);
    }
    private function json(array $body, int $status = 200): JsonResponse { return response()->json($body, $status)->header('Cache-Control', 'no-store, max-age=0')->header('Pragma', 'no-cache'); }
    private function error(string $code, int $status, array $meta = []): JsonResponse { return $this->json(['error' => array_merge(['code' => $code], $meta)], $status); }
}
