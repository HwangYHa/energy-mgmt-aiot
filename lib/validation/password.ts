/**
 * 패스워드 정책 검증
 *
 * 정책:
 * - 최소 8자, 최대 72자 (bcrypt 한계)
 * - 영문 대소문자 + 숫자 + 특수문자 각 1개 이상
 * - 연속된 동일 문자 4개 이상 금지 (aaaa, 1111)
 * - 일반적인 취약 패스워드 블랙리스트
 */

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password!', 'Password1!',
  '12345678', '123456789', '1234567890',
  'qwerty123', 'Qwerty123!', 'abc12345',
  'welcome1', 'admin1234', 'letmein1',
  'iloveyou', 'sunshine', 'monkey123',
  'dragon12', 'master12', 'login123',
  'pass1234', 'test1234', 'hello123',
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very_strong';
  score: number; // 0-100
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  // 1. 길이 검사
  if (password.length < 8) {
    errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
  } else if (password.length >= 12) {
    score += 20;
  } else {
    score += 10;
  }

  if (password.length > 72) {
    errors.push('비밀번호는 최대 72자까지 허용됩니다.');
  }

  // 2. 영문 소문자
  if (!/[a-z]/.test(password)) {
    errors.push('영문 소문자를 1자 이상 포함해야 합니다.');
  } else {
    score += 15;
  }

  // 3. 영문 대문자
  if (!/[A-Z]/.test(password)) {
    errors.push('영문 대문자를 1자 이상 포함해야 합니다.');
  } else {
    score += 15;
  }

  // 4. 숫자
  if (!/[0-9]/.test(password)) {
    errors.push('숫자를 1자 이상 포함해야 합니다.');
  } else {
    score += 15;
  }

  // 5. 특수문자
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('특수문자(!@#$%^&* 등)를 1자 이상 포함해야 합니다.');
  } else {
    score += 20;
  }

  // 6. 연속 동일 문자 4개 이상
  if (/(.)\1{3,}/.test(password)) {
    errors.push('동일한 문자를 4번 이상 연속 사용할 수 없습니다.');
    score -= 20;
  }

  // 7. 연속 증가/감소 시퀀스 (1234, abcd)
  if (hasSequentialChars(password, 4)) {
    errors.push('연속된 문자 시퀀스(1234, abcd 등)를 4개 이상 사용할 수 없습니다.');
    score -= 10;
  }

  // 8. 블랙리스트
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('너무 일반적인 비밀번호입니다. 더 복잡한 비밀번호를 사용해주세요.');
    score -= 30;
  }

  // 9. 다양성 보너스 (문자 종류가 많을수록 가산)
  const uniqueChars = new Set(password.toLowerCase()).size;
  if (uniqueChars > 8) score += 10;
  if (uniqueChars > 12) score += 5;

  score = Math.min(100, Math.max(0, score));

  let strength: PasswordValidationResult['strength'];
  if (score < 40) strength = 'weak';
  else if (score < 60) strength = 'fair';
  else if (score < 80) strength = 'strong';
  else strength = 'very_strong';

  return {
    valid: errors.length === 0,
    errors,
    strength,
    score,
  };
}

function hasSequentialChars(password: string, length: number): boolean {
  const lower = password.toLowerCase();
  for (let i = 0; i <= lower.length - length; i++) {
    let ascending = true;
    let descending = true;
    for (let j = 1; j < length; j++) {
      const diff = lower.charCodeAt(i + j) - lower.charCodeAt(i + j - 1);
      if (diff !== 1)  ascending = false;
      if (diff !== -1) descending = false;
      if (!ascending && !descending) break;
    }
    if (ascending || descending) return true;
  }
  return false;
}

/**
 * 간단한 패스워드 강도 레이블 (한국어)
 */
export function getPasswordStrengthLabel(strength: PasswordValidationResult['strength']): string {
  const labels: Record<PasswordValidationResult['strength'], string> = {
    weak:       '취약',
    fair:       '보통',
    strong:     '강함',
    very_strong: '매우 강함',
  };
  return labels[strength];
}

/**
 * 강도별 색상 (Tailwind)
 */
export function getPasswordStrengthColor(strength: PasswordValidationResult['strength']): string {
  const colors: Record<PasswordValidationResult['strength'], string> = {
    weak:       'text-red-400',
    fair:       'text-yellow-400',
    strong:     'text-green-400',
    very_strong: 'text-cyan-400',
  };
  return colors[strength];
}