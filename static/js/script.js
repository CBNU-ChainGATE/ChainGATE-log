var socket = io();

const syntaxPatterns = {
    // URL (밑줄)
    url: /[^A-Za-z_&-](http(s)?:\/\/[A-Za-z0-9_.&?=%~#{}()@+-]+:?[A-Za-z0-9_./&?=%~#{}()@+-]+)[^A-Za-z0-9_-]/g,

    // 에러 관련 (빨간색)
    red: [
        // 기본 에러 패턴
        /[^A-Za-z_&-]((bad|wrong|incorrect|improper|invalid|unsupported|bad)( file| memory)? (descriptor|alloc(ation)?|addr(ess)?|owner(ship)?|arg(ument)?|param(eter)?|setting|length|filename))[^A-Za-z_-]/gi,
        // 접근 거부 및 실패 패턴
        /[^A-Za-z_&-](not properly|improperly|(operation |connection |authentication |access |permission )?(denied|disallowed|not allowed|refused|problem|failed|failure|not permitted))[^A-Za-z_-]/gi,
        // 그 외 에러 패턴
        /[^A-Za-z_&-](no [A-Za-z]+( [A-Za-z]+)? found|invalid|unsupported|not supported|seg(mentation )?fault|corruption|corrupted|corrupt|overflow|underrun|not ok|unimplemented|unsuccessfull|not implemented)[^A-Za-z_-]/gi,
        // 다국어 에러 메시지
        /[^A-Za-z_&-](permerrors?|fehlers?|errore|errors?|erreurs?|fejl|virhe|gre쉓a|erro|crash|crashed|core dump|fel|\(ee\)|\(ni\))[^A-Za-z_-]/gi,
        // false/no/ko 패턴
        /[=>"':.,;({\[]\s*(false|no|ko)\s*[}\]]/gi
    ],

    // 성공 관련 (초록색)
    green: [
        // 성공 메시지
        /[^A-Za-z_&-](accepted|allowed|enabled|connected|erfolgreich|exitoso|successo|sucedido|framg?gsrik|successfully|successful|succeeded|success)[^A-Za-z_-]/gi,
        // true/yes/ok 패턴
        /[=>"':.,;({\[]\s*(true|yes|ok)\s*[}\]]/gi
    ],

    // 경고 관련 (노란색)
    yellow: [
        // 경고 시그널 및 기본 경고
        /[^A-Za-z_&-](\[\-w[A-Za-z-]+\]|caught signal [0-9]+|cannot)[^A-Za-z_-]/gi,
        // 연결 관련 경고
        /[^A-Za-z_&-](connection (to (remote host|[a-z0-9.]+) )?)?(closed|terminated|stopped|not responding)[^A-Za-z_-]/gi,
        // 리소스 관련 경고
        /[^A-Za-z_&-](exited|no more [A-Za-z] available|unexpected|(command |binary |file )?not found|ooo?o?o?ps|out of (space|memory)|low (memory|disk))[^A-Za-z_-]/gi,
        // 상태 관련 경고
        /[^A-Za-z_&-](unknown|disabled|disconnected|deprecated|refused|disconnect(ion)?)[^A-Za-z_-]/gi,
        // 다국어 경고 메시지
        /[^A-Za-z_&-](advertencia|avvertimento|attention|warnings?|achtung|exclamation|alerts?|warnungs?|advarsel|pedwarn|aviso|varoitus|upozorenje|peringatan|uyari|varning|avertissement|\(ww\)|\(\?\?\)|could not|unable to)[^A-Za-z_-]/gi
    ],

    // IP 주소 및 특수값 (마젠타)
    magenta: [
        /[^0-9A-Za-z_&-](localhost|([1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-4])\.[0-9]+\.[0-9]+\.[0-9]+|null|none)[^0-9A-Za-z_-]/gi
    ],

    // 정보 메시지 (시안)
    cyan: [
        /[^A-Za-z_&-](last (failed )?login:|launching|checking|loading|creating|building|important|booting|starting|notice|informational|informationen|informazioni|informa豫o|oplysninger|informations?|info|informaci?|informasi|note|\(ii\)|\(\!\!\))[^A-Za-z_-]/gi
    ]
};

function highlightLog(content) {
    let highlightedContent = content;

    // 각 색상 패턴에 대해 하이라이팅 적용
    for (const [color, patterns] of Object.entries(syntaxPatterns)) {
        if (Array.isArray(patterns)) {
            patterns.forEach(pattern => {
                highlightedContent = highlightedContent.replace(pattern,
                    match => `<span class="highlight-${color}">${match}</span>`);
            });
        } else {
            highlightedContent = highlightedContent.replace(patterns,
                match => `<span class="highlight-${color}">${match}</span>`);
        }
    }

    return highlightedContent;
}

function convertLogToHtml(text) {
    const colorToHtmlClass = {
        // 기본 색상 (30-37)
        '30': 'ansi-black',
        '31': 'ansi-red',
        '32': 'ansi-green',
        '33': 'ansi-yellow',
        '34': 'ansi-blue',
        '35': 'ansi-magenta',
        '36': 'ansi-cyan',
        '37': 'ansi-white',

        // 밝은 색상 (90-97)
        '90': 'ansi-bright-black',
        '91': 'ansi-bright-red',
        '92': 'ansi-bright-green',
        '93': 'ansi-bright-yellow',
        '94': 'ansi-bright-blue',
        '95': 'ansi-bright-magenta',
        '96': 'ansi-bright-cyan',
        '97': 'ansi-bright-white',

        // 배경 색상 (40-47)
        '40': 'ansi-bg-black',
        '41': 'ansi-bg-red',
        '42': 'ansi-bg-green',
        '43': 'ansi-bg-yellow',
        '44': 'ansi-bg-blue',
        '45': 'ansi-bg-magenta',
        '46': 'ansi-bg-cyan',
        '47': 'ansi-bg-white',

        // 스타일
        '1': 'ansi-bold',
        '3': 'ansi-italic',
        '4': 'ansi-underline'
    };

    const colorRegex = /\u001b\[([\d;]+)m/g;
    let activeClasses = new Set();
    let hasOpenSpan = 0;

    const htmlText = text.replace(colorRegex, (match, p1) => {
        const codes = p1.split(';');
        let result = '';

        // if (hasOpenSpan) {
        //     result += '</span>';
        //     hasOpenSpan = 0;
        // }

        console.log("codes: ")
        console.log(codes);

        if (codes.includes('0')) {
            while (hasOpenSpan > 0) {
                result += '</span>';
                hasOpenSpan--;
            }
            activeClasses.clear();
            return result;
        }

        const newClasses = codes
            .map(code => colorToHtmlClass[code])
            .filter(className => className);

        if (newClasses.length > 0) {
            activeClasses = new Set([...activeClasses, ...newClasses]);
            console.log("activeClasses: ")
            console.log(activeClasses);
            result += `<span class="${Array.from(activeClasses).join(' ')}">`;
            hasOpenSpan++;
        }

        return result;
    });

    // return hasOpenSpan ? htmlText + '</span>' : htmlText;
    return htmlText;
}

socket.on('log_update', function(data) {
    var logContents = document.getElementsByClassName(data.filename);

    // 색상 코드를 HTML로 변환
    const highlightedContent = highlightLog(data.content);
    const colorConverted = convertLogToHtml(highlightedContent);

    // 모든 요소에 대해 반복
    for (let i = 0; i < logContents.length; i++) {
        const logContent = logContents[i];
        const contentDiv = logContent.closest('.content');

        const isScrolledToBottom = contentDiv.scrollHeight - contentDiv.clientHeight <= contentDiv.scrollTop + (contentDiv.scrollHeight/10);
        logContent.innerHTML = colorConverted;

        // 스크롤이 하단에 위치해 있으면 스크롤 이동
        if (isScrolledToBottom) {
            contentDiv.scrollTop = contentDiv.scrollHeight;
        }
    }
});


function openTab(event, tabContent) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active-content'));
    document.getElementById(tabContent).classList.add('active-content');
}

function initializeLogs() {
    const logFiles = ['caserver.log', 'node1.log', 'node2.log', 'node3.log', 'node4.log'];
    logFiles.forEach(file => {
        const logContents = document.getElementsByClassName(file);
        for (let i = 0; i < logContents.length; i++) {
            const logContent = logContents[i];
            // 초기 하이라이팅 적용
            const highlightedContent = highlightLog(logContent.innerHTML);
            const colorConverted = convertLogToHtml(highlightedContent);
            logContent.innerHTML = colorConverted;
        }
    });
}

// 페이지가 로드될 때 하이라이팅 적용
window.onload = function() {
    initializeLogs();  // 로그 내용을 초기화하고 하이라이팅 적용
};
