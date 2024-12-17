# name matcher

# 다국어 이름 유사도 비교 시스템 분석 1 (node-google-translate-skidz)

## 1. 주요 기능
* 다국어 지원 시스템으로 한국어, 중국어, 일본어, 베트남어, 영어로 작성된 이름들을 비교하고 유사도를 측정할 수 있습니다. 자동 언어 감지 기능을 통해 입력된 텍스트의 언어를 식별하고, 비영어 텍스트는 영어로 번역하여 비교를 수행합니다.

* 여러 유사도 측정 알고리즘을 통합적으로 사용하여 정확한 비교 결과를 도출합니다. 각 알고리즘의 결과값에 가중치를 적용하여 최종 유사도 점수를 계산합니다.

## 2. 사용된 알고리즘
* **음성적 유사도 (Phonetic Similarity)**: 이름의 발음 유사성을 비교
* **Jaro-Winkler 거리**: 문자열 편집 거리를 기반으로 한 유사도 측정
* **Levenshtein 거리**: 두 문자열 간의 최소 편집 거리 계산
* **N-gram 유사도**: 문자열을 n개 단위로 분할하여 유사도 측정

## 3. 특별한 처리 기능
* 이름 순서 변경 감지 기능 (예: "Kim Cheolsoo" ↔ "Cheolsoo Kim")
* CamelCase 형식의 이름 자동 분리 처리
* 번역 실패 시 기본 유사도 계산 로직으로 전환
* 다양한 형태의 입력값 정규화 처리

## 4. 점수 계산 방식
* 알고리즘별 차등 가중치 적용
* 이름 순서 변경 감지 시 가중치 조정
* 최종 점수는 100점 만점 기준으로 환산
* 이상치 제거를 통한 정확도 향상

## 5. 오류 처리 메커니즘
* 번역 실패에 대한 대체 로직 구현
* 빈 문자열 및 유효하지 않은 입력값 처리
* 예외 상황에 대한 포괄적인 에러 핸들링

## 6. 테스트 케이스 구성
* 다국어 이름 조합 테스트
* 순서가 바뀐 이름 테스트
* 유사하지만 다른 이름 테스트
* 혼합 언어 케이스 테스트

## 7. 활용 분야
* 국제 데이터베이스 중복 검사
* 다국어 환경 사용자 식별
* 이름 매칭 시스템
* 다국어 문서 내 동일 인물 식별

## 8. 시스템 평가

### 장점
* 광범위한 다국어 지원
* 다중 알고리즘 통합으로 높은 정확도
* 이름 순서 변경에 대한 유연한 대응
* 강건한 오류 처리 시스템

### 개선 가능 사항
* 번역 시스템 의존도가 높음
* 고정된 가중치 시스템
* 일부 언어 감지 정규식의 제한성

## 9. 주요 코드 구조

### 언어 감지 함수
```javascript
function detectLanguage(text) {
     // 한국어 감지
    if (/[가-힣]/.test(text)) return 'ko';
    // 중국어 감지
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    // 일본어 감지
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    // 베트남어 감지
    if (/[àáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỵỷỹ]/.test(text)) return 'vi';
    // 영어 감지
    if (/^[A-Za-z\s.]+$/.test(text)) return 'en';

    return 'en'; // 기본값
}
```

### 유사도 계산 함수
```javascript
function calculateSimilarity(text1, text2) {
    const norm1 = normalizeForComparison(text1);
    const norm2 = normalizeForComparison(text2);

    const phoneticSimilarity = calculatePhoneticSimilarity(norm1, norm2);
    const jwSimilarity = natural.JaroWinklerDistance(norm1, norm2);
    const levDistance = natural.LevenshteinDistance(norm1, norm2);
    const levSimilarity = 1 - levDistance / Math.max(norm1.length, norm2.length);
    const bigramSimilarity = ngramSimilarity(norm1, norm2, 2);

    return { 
        phoneticSimilarity, 
        jwSimilarity, 
        levSimilarity, 
        bigramSimilarity 
    };
}
```

## 10. 구현시 주의사항
* 번역 API의 안정성 확보 필요
* 다국어 처리시 인코딩 문제 주의
* 대용량 데이터 처리시 성능 최적화 필요
* 정규식 패턴의 정확성 검증 필요



# 한글-영문 이름 매칭 시스템 분석 (compareText-romanize.js)

## 1. 주요 사항

### 1.1 한글 처리
* `@romanize/korean` 라이브러리 도입으로 한글의 로마자 변환 지원
* 한글 포함 여부 확인을 위한 `containsHangul()` 함수 추가
* 한글-영문 혼용 케이스 처리를 위한 `isMixedLanguageCase()` 함수 구현

### 1.2 정규화 프로세스 개선
```javascript
function normalizeAndRomanize(text) {
    const normalized = preprocessName(text);
    const romanized = containsHangul(normalized) ? 
        romanize(normalized).toLowerCase().replace(/\s+/g, '') : 
        normalized.toLowerCase().replace(/\s+/g, '');
    return { normalized, romanized };
}
```

## 2. 핵심 기능

### 2.1 이름 비교 로직
* 기본 문자열 비교
* 로마자 변환 후 비교
* 발음 유사도 비교
* N-gram 유사도 비교

### 2.2 특수 케이스 처리
* 완전히 다른 이름 감지
* 혼합 언어 케이스 처리
* 이름 순서 변경 감지
* CamelCase 형식 처리

## 3. 가중치 시스템

### 3.1 상황별 가중치 조정
```javascript
if (isNameSwapped) {
    weights = [0.4, 0.3, 0.2, 0.1]; // 어순 변경시 발음과 JW 중시
} else if (isMixedLanguage) {
    weights = [0.45, 0.25, 0.2, 0.1]; // 이종 언어는 발음 중시
} else {
    weights = [0.3, 0.3, 0.25, 0.15]; // 일반적인 경우
}
```

## 4. 주요 개선사항

### 4.1 정확도 향상
* 한글 로마자 변환 도입으로 발음 기반 매칭 정확도 향상
* 혼합 언어 케이스에 대한 특별 처리
* 이름 순서 변경 감지 로직 개선

### 4.2 예외 처리
* 완전히 다른 이름 감지 기능
* 빈 문자열 및 특수문자 처리
* 한글-영문 변환 실패 대응

## 5. 성능 특성

### 5.1 장점
* 한글-영문 이름 매칭에 최적화
* 다양한 케이스(순서 변경, 혼합 언어 등) 처리
* 강건한 예외 처리

### 5.2 제한사항
* 로마자 변환 의존성
* 계산 복잡도 증가
* 메모리 사용량 증가

## 6. 활용 시나리오

### 6.1 적합한 사용 케이스
* 한글 이름의 영문 표기 매칭
* 회원 데이터 중복 검사
* 다국어 문서에서의 인명 검색
* 고객 데이터 통합

### 6.2 주의사항
* 대량 데이터 처리시 성능 고려 필요
* 한글 로마자 변환의 정확성 검증 필요
* 가중치 시스템의 주기적인 검증과 조정 필요


# Google 번역 API 기반 다국어 이름 매칭 시스템 분석 (compareText-gcp-translator)

## 1. 주요 사항

### 1.1 Google Cloud Translation 통합
* Google Cloud Translation API v2 도입
* 프로젝트 설정 및 인증 파일 연동
* 자동 언어 감지 및 번역 기능 구현

### 1.2 언어 감지 로직
```javascript
async function detectLanguage(text) {
    if (/^[A-Za-z\s.]+$/.test(text)) {
        return 'en';
    }
    try {
        const [detection] = await translate.detect(text);
        return detection.language;
    } catch (error) {
        return 'en';
    }
}
```

## 2. 핵심 기능 개선

### 2.1 번역 프로세스
* 영어 텍스트 자동 감지 및 스킵
* 비영어 텍스트의 영어 변환
* 번역 오류 처리 및 폴백 메커니즘

### 2.2 이름 매칭 최적화
* 대소문자 무시 정확 매칭
* 순서 변경 감지 개선
* 번역 후 유사도 계산

## 3. 점수 계산 시스템

### 3.1 기본 점수 체계
* 정확히 일치: 92.30점
* 순서만 다른 영어 텍스트: 86.15점
* 번역 후 순서가 다른 경우: 85.20점

### 3.2 가중치 적용
```javascript
if (isSwapped) {
    weights = [0.4, 0.3, 0.2, 0.1];
} else {
    weights = [0.3, 0.3, 0.25, 0.15];
}
```

## 4. 예외 처리 강화

### 4.1 번역 실패 대응
* 원본 텍스트 유지
* 기본 유사도 계산으로 폴백
* 에러 로깅 및 모니터링

### 4.2 입력 검증
* 널/빈 문자열 처리
* 타입 검증
* 특수 문자 정규화

## 5. 테스트 케이스 확장

### 5.1 다국어 테스트
* 한국어-영어 변환
* 중국어-영어 변환
* 일본어-영어 변환
* 베트남어-영어 변환

### 5.2 특수 케이스
* 동일 텍스트
* 순서 변경
* 대소문자 차이
* 혼합 언어

## 6. 성능 특성

### 6.1 장점
* 정확한 언어 감지
* 신뢰성 있는 번역
* 확장된 언어 지원
* 강건한 오류 처리

### 6.2 고려사항
* API 의존성
* 네트워크 지연
* 비용 관리
* 성능 최적화 필요

## 7. 구현 주의사항

### 7.1 설정 요구사항
* Google Cloud 프로젝트 설정
* API 키 관리
* 인증 파일 보안

### 7.2 운영 고려사항
* API 호출 제한 관리
* 에러 모니터링
* 비용 모니터링
* 성능 모니터링

## 8. 개선 제안사항

### 8.1 단기 개선점
* 캐싱 메커니즘 도입
* 배치 처리 최적화
* 에러 처리 세분화

### 8.2 장기 개선점
* 머신러닝 모델 통합
* 자체 번역 엔진 개발 검토
* 성능 메트릭 시스템 구축
