
const natural = require('natural');
const { romanize } = require('@romanize/korean');


module.exports = async (text1, text2, debug = false) => {
    console.log("text1: ", text1, " || text2: ", text2)
    let Library = await returnNaturalResult(text1, text2);

    let Phonetic = Library.finalPhoneticSimilarity !== undefined ? parseFloat(Library.finalPhoneticSimilarity) : 0;
    let JaroWinkler = Library.finalJwSimilarity !== undefined ? parseFloat(Library.finalJwSimilarity) : 0;
    let Levenshtein = Library.finalLevSimilarity !== undefined ? parseFloat(Library.finalLevSimilarity) : 0;
    let Ngram = Library.finalBigramSimilarity !== undefined ? parseFloat(Library.finalBigramSimilarity) : 0;

    if (debug) {
        console.log("Phonetic: ", Phonetic);
        console.log("JaroWinkler: ", JaroWinkler);
        console.log("Levenshtein: ", Levenshtein);
        console.log("Ngram: ", Ngram);
    }

    const isMixed = isMixedLanguageCase(text1, text2);
    const isSwapped = checkNameSwapped(text1, text2);
    if (debug) {
        console.log("isMixedLanguage: ", isMixed);
        console.log("isNameSwapped: ", isSwapped);
    }

    const finalScore = calculateFinalScore([Phonetic, JaroWinkler, Levenshtein, Ngram], text1, text2);
    if (debug) console.log("returned finalScore:: ", finalScore);

    return finalScore;
}

function checkCompletelyDifferent(text1, text2) {
    const normalized1 = normalizeForComparison(text1);
    const normalized2 = normalizeForComparison(text2);
    
    // 한/영 변환 후 비교
    const rom1 = containsHangul(text1) ? romanize(text1) : text1;
    const rom2 = containsHangul(text2) ? romanize(text2) : text2;
    const normalizedRom1 = normalizeForComparison(rom1);
    const normalizedRom2 = normalizeForComparison(rom2);
    
    // 기본 유사도 검사
    const baseJW = natural.JaroWinklerDistance(normalized1, normalized2);
    const romJW = natural.JaroWinklerDistance(normalizedRom1, normalizedRom2);
    
    return baseJW < 0.3 && romJW < 0.3;
}

function normalizeForComparison(text) {
    return text.toLowerCase()
        .replace(/[^a-zA-Z가-힣]/g, '')
        .replace(/\s+/g, '');
}

function isMixedLanguageCase(text1, text2) {
    const hasHangul1 = /[가-힣]/.test(text1);
    const hasHangul2 = /[가-힣]/.test(text2);
    const isEnglish1 = /^[A-Za-z\s.]+$/.test(text1);
    const isEnglish2 = /^[A-Za-z\s.]+$/.test(text2);
    
    return (hasHangul1 && isEnglish2) || (hasHangul2 && isEnglish1);
}

function checkNameSwapped(text1, text2) {
    const parts1 = text1.split(/\s+/).map(p => p.toLowerCase());
    const parts2 = text2.split(/\s+/).map(p => p.toLowerCase());
    
    // 공백으로 분리된 부분이 1개 이하면 순서 변경이 아님
    if (parts1.length <= 1 || parts2.length <= 1) {
        return false;
    }
    
    // 한/영 변환 비교
    const rom1 = parts1.map(p => containsHangul(p) ? romanize(p).toLowerCase() : p);
    const rom2 = parts2.map(p => containsHangul(p) ? romanize(p).toLowerCase() : p);
    
    // 순서만 다르고 내용이 같은지 확인
    const sorted1 = rom1.slice().sort().join('');
    const sorted2 = rom2.slice().sort().join('');
    const original1 = rom1.join('');
    const original2 = rom2.join('');
    
    return sorted1 === sorted2 && original1 !== original2;
}

function returnNaturalResult(text1, text2) {
    const isSwapped = checkNameSwapped(text1, text2);
    const isMixed = isMixedLanguageCase(text1, text2);
    
    let parts1 = text1.split(/\s+/);
    let parts2 = text2.split(/\s+/);
    
    if (parts1.length === 1 && parts1[0].length > 3) {
        parts1 = splitCamelCase(parts1[0]);
    }
    if (parts2.length === 1 && parts2[0].length > 3) {
        parts2 = splitCamelCase(parts2[0]);
    }
    
    let maxPhonetic = 0, maxJw = 0, maxLev = 0, maxBigram = 0;
    let sumPhonetic = 0, sumJw = 0, sumLev = 0, sumBigram = 0;
    let comparisons = 0;
    
    // 모든 가능한 부분 매칭 시도
    for (const p1 of parts1) {
        for (const p2 of parts2) {
            const sim = calculateSimilarity(p1, p2);
            maxPhonetic = Math.max(maxPhonetic, sim.phoneticSimilarity);
            maxJw = Math.max(maxJw, sim.jwSimilarity);
            maxLev = Math.max(maxLev, sim.levSimilarity);
            maxBigram = Math.max(maxBigram, sim.bigramSimilarity);
            
            sumPhonetic += sim.phoneticSimilarity;
            sumJw += sim.jwSimilarity;
            sumLev += sim.levSimilarity;
            sumBigram += sim.bigramSimilarity;
            comparisons++;
        }
    }
    
    const avgPhonetic = sumPhonetic / comparisons;
    const avgJw = sumJw / comparisons;
    const avgLev = sumLev / comparisons;
    const avgBigram = sumBigram / comparisons;
    
    // 전체 문자열 유사도
    const fullSim = calculateSimilarity(text1, text2);

    // 가중치 설정
    let maxWeight, avgWeight, fullWeight;
    if (isSwapped) {
        maxWeight = 0.6;  // 어순 변경시 최대값 가중치 증가
        avgWeight = 0.25;
        fullWeight = 0.15;
    } else if (isMixed) {
        maxWeight = 0.5;
        avgWeight = 0.3;
        fullWeight = 0.2;
    } else {
        maxWeight = 0.4;
        avgWeight = 0.3;
        fullWeight = 0.3;
    }
    
    const finalJwSimilarity = (maxJw * maxWeight + avgJw * avgWeight + fullSim.jwSimilarity * fullWeight).toFixed(2);
    const finalLevSimilarity = (maxLev * maxWeight + avgLev * avgWeight + fullSim.levSimilarity * fullWeight).toFixed(2);
    const finalBigramSimilarity = (maxBigram * maxWeight + avgBigram * avgWeight + fullSim.bigramSimilarity * fullWeight).toFixed(2);
    const finalPhoneticSimilarity = (maxPhonetic * maxWeight + avgPhonetic * avgWeight + fullSim.phoneticSimilarity * fullWeight).toFixed(2);
    
    return { finalJwSimilarity, finalLevSimilarity, finalBigramSimilarity, finalPhoneticSimilarity };
}

function splitCamelCase(str) {
    if (/[가-힣]/.test(str)) return [str];
    const result = str.replace(/([A-Z])/g, ' $1').trim();
    return result.split(/\s+/);
}

function calculateSimilarity(text1, text2) {
    // 전처리 및 로마자 변환
    const { normalized: norm1, romanized: rom1 } = normalizeAndRomanize(text1);
    const { normalized: norm2, romanized: rom2 } = normalizeAndRomanize(text2);
    
    // 발음 유사도 (로마자 기준)
    const phoneticSimilarity = calculatePhoneticSimilarity(rom1, rom2);
    
    // 문자열 유사도 계산 (로마자 기준)
    const jwSimilarity = natural.JaroWinklerDistance(rom1, rom2);
    const levDistance = natural.LevenshteinDistance(rom1, rom2);
    const levSimilarity = 1 - levDistance / Math.max(rom1.length, rom2.length);
    const bigramSimilarity = ngramSimilarity(rom1, rom2, 2);

    return { phoneticSimilarity, jwSimilarity, levSimilarity, bigramSimilarity };
}

function normalizeAndRomanize(text) {
    const normalized = preprocessName(text);
    const romanized = containsHangul(normalized) ? 
        romanize(normalized).toLowerCase().replace(/\s+/g, '') : 
        normalized.toLowerCase().replace(/\s+/g, '');
    return { normalized, romanized };
}

function containsHangul(text) {
    return /[가-힣]/.test(text);
}

function preprocessName(name) {
    return name.toLowerCase().replace(/[^a-zA-Z0-9\s가-힣]/g, '');
}

function calculatePhoneticSimilarity(text1, text2) {
    const metaphone1 = natural.DoubleMetaphone.process(text1);
    const metaphone2 = natural.DoubleMetaphone.process(text2);

    const jwSimilarityPrimary = natural.JaroWinklerDistance(metaphone1[0], metaphone2[0]);
    const jwSimilaritySecondary = natural.JaroWinklerDistance(metaphone1[1], metaphone2[1]);

    return (jwSimilarityPrimary + jwSimilaritySecondary) / 2;
}

function ngramSimilarity(text1, text2, n=2) {
    if (text1.length < n || text2.length < n) {
        return text1 === text2 ? 1 : 0;
    }

    const ngrams1 = new Set();
    const ngrams2 = new Set();

    for(let i = 0; i <= text1.length - n; i++) {
        ngrams1.add(text1.slice(i, i + n));
    }

    for(let i = 0; i <= text2.length - n; i++) {
        ngrams2.add(text2.slice(i, i + n));
    }

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
}

function calculateFinalScore(scores, text1, text2) {
    const isMixedLanguage = isMixedLanguageCase(text1, text2);
    const isNameSwapped = checkNameSwapped(text1, text2);
    
    // 상황별 가중치 조정
    let weights;
    if (isNameSwapped) {
        weights = [0.4, 0.3, 0.2, 0.1]; // 어순 변경시 발음과 JW 중시
    } else if (isMixedLanguage) {
        weights = [0.45, 0.25, 0.2, 0.1]; // 이종 언어는 발음 중시
    } else {
        weights = [0.3, 0.3, 0.25, 0.15]; // 일반적인 경우
    }
    
    const weightedScores = scores.map((score, i) => score * weights[i]);
    const weightedAvg = weightedScores.reduce((a, b) => a + b, 0);
    
    // 표준편차 계산
    const stdev = Math.sqrt(scores.reduce((acc, val) => acc + Math.pow(val - weightedAvg, 2), 0) / scores.length);
    
    // 필터링
    const filteredScores = scores.filter(score => Math.abs(score - weightedAvg) <= 2 * stdev && score !== 0);
    const numDiscarded = scores.length - filteredScores.length;
    
    // 페널티 적용
    const penalty = (isNameSwapped || isMixedLanguage) ? 0.02 * numDiscarded : 0.05 * numDiscarded;
    let finalScore = weightedAvg * (1 - penalty);
        
    return (finalScore * 100).toFixed(2);
}


// 시뮬레이션을 위한 테스트 케이스들
const testCases = [
    ['아르고스아이덴티티', 'ARGOS IDENTITY'],
    ['비씨카드', 'BC Card'],
];
async function compareName(text1, text2) {
    // ... [previous comparison logic remains the same]
    // Note: This would contain all the existing comparison functions
    return module.exports(text1, text2);
}

async function runSimulation(debug = false) {
    for (const [name1, name2] of testCases) {
        const score = await module.exports(name1, name2, debug);
        // Only output the tab-separated format
        console.log(`${name1}\t${name2}\t${score}`);
    }
}

// 시뮬레이션 실행
runSimulation(false);
