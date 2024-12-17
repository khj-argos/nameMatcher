const natural = require('natural');
const translator = require('node-google-translate-skidz');


// 번역 함수 수정
function translateToEnglish(text, sourceLang) {
    return new Promise((resolve, reject) => {
        if (sourceLang === 'en') {
            resolve(text);
            return;
        }

        try {
            translator(text, sourceLang, 'en', (result) => {
                if (!result) {
                    console.log("Translation failed, using original text:", text);
                    resolve(text);
                    return;
                }
                console.log("Translation result for", text, ":", result);
                resolve(result);
            });
        } catch (error) {
            console.error('Translation error for text:', text, error);
            resolve(text);
        }
    });
}


// 언어 감지 함수
function detectLanguage(text) {
     // 한국어 감지
    if (/[가-힣]/.test(text)) return 'ko';
    // 중국어 감지
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    // 일본어 감지
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    // 베트남어 감지 (베트남어 특수 문자 포함)
    if (/[àáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỵỷỹ]/.test(text)) return 'vi';
    //if (/[\u00C0-\u00C3\u00C8-\u00CA\u00CC-\u00CD\u00D2-\u00D5\u00D9-\u00DA\u00DD\u00E0-\u00E3\u00E8-\u00EA\u00EC-\u00ED\u00F2-\u00F5\u00F9-\u00FA\u00FD\u0102-\u0103\u0110-\u0111\u0128-\u0129\u0168-\u0169\u01A0-\u01A1\u01AF-\u01B0\u1EA0-\u1EF9]/.test(text)) return 'vi';
    // 영어 감지
    if (/^[A-Za-z\s.]+$/.test(text)) return 'en';

    return 'en'; // 기본값
}



module.exports = async (text1, text2, debug = false) => {
    if (debug) console.log("Original text1: ", text1, " || text2: ", text2);

    try {
        const lang1 = detectLanguage(text1);
        const lang2 = detectLanguage(text2);

        if (debug) console.log("Detected languages:", lang1, lang2);

        let translatedText1 = await translateToEnglish(text1, lang1);
        let translatedText2 = await translateToEnglish(text2, lang2);

        // 결과가 문자열인지 확인하고 처리
        translatedText1 = String(translatedText1).trim();
        translatedText2 = String(translatedText2).trim();

        if (debug) {
            console.log("Translated text1: ", translatedText1);
            console.log("Translated text2: ", translatedText2);
        }

        // 빈 문자열이나 번역 실패 처리
        if (!translatedText1 || !translatedText2) {
            if (debug) console.log("Translation failed, using basic similarity");
            return calculateBasicSimilarity(text1, text2);
        }

        let Library = await returnNaturalResult(translatedText1, translatedText2);

        let Phonetic = Library.finalPhoneticSimilarity !== undefined ? parseFloat(Library.finalPhoneticSimilarity) : 0;
        let JaroWinkler = Library.finalJwSimilarity !== undefined ? parseFloat(Library.finalJwSimilarity) : 0;
        let Levenshtein = Library.finalLevSimilarity !== undefined ? parseFloat(Library.finalLevSimilarity) : 0;
        let Ngram = Library.finalBigramSimilarity !== undefined ? parseFloat(Library.finalBigramSimilarity) : 0;

        if (debug) {
            console.log("Scores after translation:");
            console.log("Phonetic: ", Phonetic);
            console.log("JaroWinkler: ", JaroWinkler);
            console.log("Levenshtein: ", Levenshtein);
            console.log("Ngram: ", Ngram);
        }

        const isSwapped = checkNameSwapped(translatedText1, translatedText2);
        if (debug) {
            console.log("isNameSwapped: ", isSwapped);
        }

        // 모든 점수가 0인 경우 기본 유사도 사용
        if (Phonetic === 0 && JaroWinkler === 0 && Levenshtein === 0 && Ngram === 0) {
            if (debug) console.log("All scores are 0, using basic similarity");
            return calculateBasicSimilarity(text1, text2);
        }

        const finalScore = calculateFinalScore([Phonetic, JaroWinkler, Levenshtein, Ngram], translatedText1, translatedText2);
        if (debug) console.log("returned finalScore:: ", finalScore);

        return finalScore;
    } catch (error) {
        console.error('Error during comparison:', error);
        return calculateBasicSimilarity(text1, text2);
    }
};

// 정규화 함수 수정
function normalizeForComparison(text) {
    if (!text) return '';
    return text.toLowerCase()
        //.replace(/[^a-z0-9]/g, '')  // 영어와 숫자만 허용
        .replace(/[^a-z]/g, '')  // 영어만 허용
        .replace(/\s+/g, '');
}


function checkNameSwapped(text1, text2) {
    // 입력값 검증 추가
    if (!text1 || !text2 || typeof text1 !== 'string' || typeof text2 !== 'string') {
        return false;
    }

    const parts1 = text1.toString().split(/\s+/).map(p => p.toLowerCase());
    const parts2 = text2.toString().split(/\s+/).map(p => p.toLowerCase());
    
    if (parts1.length <= 1 || parts2.length <= 1) {
        return false;
    }
    
    const sorted1 = parts1.slice().sort().join('');
    const sorted2 = parts2.slice().sort().join('');
    const original1 = parts1.join('');
    const original2 = parts2.join('');
    
    return sorted1 === sorted2 && original1 !== original2;
}


// 유사도 계산 함수 수정
function calculateSimilarity(text1, text2) {
    if (!text1 || !text2) {
        return {
            phoneticSimilarity: 0,
            jwSimilarity: 0,
            levSimilarity: 0,
            bigramSimilarity: 0
        };
    }

    const norm1 = normalizeForComparison(text1);
    const norm2 = normalizeForComparison(text2);

    if (!norm1 || !norm2) {
        return {
            phoneticSimilarity: 0,
            jwSimilarity: 0,
            levSimilarity: 0,
            bigramSimilarity: 0
        };
    }
    
    const phoneticSimilarity = calculatePhoneticSimilarity(norm1, norm2);
    const jwSimilarity = natural.JaroWinklerDistance(norm1, norm2);
    const levDistance = natural.LevenshteinDistance(norm1, norm2);
    const levSimilarity = 1 - levDistance / Math.max(norm1.length, norm2.length);
    const bigramSimilarity = ngramSimilarity(norm1, norm2, 2);

    return { phoneticSimilarity, jwSimilarity, levSimilarity, bigramSimilarity };
}


function returnNaturalResult(text1, text2) {
    // 입력값 검증 추가
    text1 = String(text1);
    text2 = String(text2);

    const isSwapped = checkNameSwapped(text1, text2);
    
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
    
    const fullSim = calculateSimilarity(text1, text2);

    let maxWeight, avgWeight, fullWeight;
    if (isSwapped) {
        maxWeight = 0.6;
        avgWeight = 0.25;
        fullWeight = 0.15;
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
    const result = str.replace(/([A-Z])/g, ' $1').trim();
    return result.split(/\s+/);
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
    const isSwapped = checkNameSwapped(text1, text2);
    
    let weights;
    if (isSwapped) {
        weights = [0.4, 0.3, 0.2, 0.1];
    } else {
        weights = [0.3, 0.3, 0.25, 0.15];
    }
    
    const weightedScores = scores.map((score, i) => score * weights[i]);
    const weightedAvg = weightedScores.reduce((a, b) => a + b, 0);
    
    const stdev = Math.sqrt(scores.reduce((acc, val) => acc + Math.pow(val - weightedAvg, 2), 0) / scores.length);
    const filteredScores = scores.filter(score => Math.abs(score - weightedAvg) <= 2 * stdev && score !== 0);
    const numDiscarded = scores.length - filteredScores.length;
    
    const penalty = isSwapped ? 0.02 * numDiscarded : 0.05 * numDiscarded;
    let finalScore = weightedAvg * (1 - penalty);
        
    return (finalScore * 100).toFixed(2);
}

// 번역 실패시 사용할 기본 유사도 계산
function calculateBasicSimilarity(text1, text2) {
    const norm1 = normalizeForComparison(text1);
    const norm2 = normalizeForComparison(text2);
    const similarity = natural.JaroWinklerDistance(norm1, norm2);
    return (similarity * 100).toFixed(2);
}

// 테스트 케이스
const testCases = [
    ['아르고스아이덴티티', 'ARGOS IDENTITY'],
    ['비씨카드', 'BC Card'],
    ['김철수', 'Kim Cheol Soo'],
    ['김현종', 'Kim Hyun Jong'],
    ['山田太郎', 'Taro Yamada'],
    ['中村 善治', 'Yoshiharu Nakamura'],
    ['박지성', 'Ji Sung Park'],
    ['이순신', 'Yi Soon Shin'],
    ['김현종', 'Kim Hyun Jong'],
    ['김현종', '김현종'],
    ['김현종', '현종김'],
    ['Hyun Jong Kim', 'Kim Hyun Jong'],
    ['KIM HYUN JONG', '김현종'],
    ['Hyeonjong Kim', 'Hyeonjong Kim'],
    ['김현종', 'KimHyunJong'],
    ['XIN RU YU', 'YU XIN RU'],
    ['LU PEI YI', 'PEI YI LU'],
    ['ROGER MARC G VANDE VOORDE', 'VANDE VOORDE ROGER MARC G'],
    ['CHOKJAROENVORAKUN MISS BENYAPA', 'MISS BENYAPA CHOKJAROENVORAKUN'],
    ['MRS. JITNAPA JUENGKAJORNKIAT', 'MRS JITNAPA JUENGKAJORNKIAT'],
    ['ZHIQI ZHOU', 'ZHOU ZHIQI'],
    ['LU PEI YI', 'PEI YI'],
    ['ZHIQI ZHOU', 'ZHOU ZHIQI'],    
    ["YUSU FANG", "FANG YUSU"],
    ["WANG XI", "XI WANG"],
    ["HUANG XIAOFEN", "XIAOFEN HUANG"],
    // 한글 테스트 케이스
    ["김철수", "철수 김"],
    ["이지은", "지은 이"],
    // 유사하지만 다른 케이스
    ["YUSU FANG", "YUSU FONG"],
    ["WANG XI", "WANG XIN"],
    // 혼합 언어 케이스
    ["김지수 KIM", "KIM JISOO"],
    ["TRẦN MINH HÙNG", "Tran Minh Hung"],
    ["VÕ QUỲNH THẢO NHI", "VÕ QUỲNH THẢO NHI"]
];

async function runSimulation(debug = false) {
    console.log("Name1\tName2\tScore");
    console.log("----------------------------------------------------------");
    
    for (const [name1, name2] of testCases) {
        console.log("----------------------------------------------------------");
        const score = await module.exports(name1, name2, debug);
        console.log(`${name1}\t${name2}\t${score}`);
        console.log("----------------------------------------------------------");
    }
}

// 시뮬레이션 실행
runSimulation(true);