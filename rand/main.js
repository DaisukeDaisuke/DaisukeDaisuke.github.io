function decodeHexValue(hexString) {
    if (hexString.startsWith('0x')) {
        // 0xから始まる場合、そのまま16進数として解釈
        return parseInt(hexString, 16);
    } else {
        // 0xから始まらない場合、0xを追加して16進数として解釈
        return parseInt('0x' + hexString, 16);
    }
}
let dropdownCounter = 0; // カウンターを初期化

function generateDropdown() {
    // 新しいdropdown-containerを生成
    const dropdownContainer = document.createElement("div");
    dropdownContainer.classList.add("dropdown-container");

    // 新しいselect要素（menu）を生成
    const selectElement = document.createElement("select");
    const selectId = "menu" + dropdownCounter; // IDを動的に生成
    selectElement.id = selectId;
    selectElement.innerHTML = `
        <option value=""></option>
        <option value="ようす">ようす</option>
        <option value="こうげき">こうげき</option>
    `;

    // 新しいspan要素（box）を生成
    const spanElement = document.createElement("span");
    spanElement.classList.add("box");
    spanElement.textContent = dropdownCounter + 1; // 数字を設定
    selectElement.addEventListener('input', onTableUpdate);
    // dropdown-containerにselect要素とspan要素を追加
    dropdownContainer.appendChild(selectElement);
    dropdownContainer.appendChild(spanElement);

    // .dropdown内にdropdown-containerを追加
    const dropdown = document.querySelector(".dropdown");
    dropdown.appendChild(dropdownContainer);

    // カウンターをインクリメント
    dropdownCounter++;
}

function createBrElement(parent){
    // 新しいp要素を作成
    const newParagraph = document.createElement('br');

    // 親要素を取得
    const parentElement = document.getElementById(parent);

    // 新しいp要素を親要素に追加
    parentElement.appendChild(newParagraph);
}

function createPElement(parent, content){
    // 新しいp要素を作成
    const newParagraph = document.createElement('p');

    // 新しいp要素のテキストコンテンツを設定（ここでは検索ワードとして"新しい要素"を使用）
    newParagraph.textContent = content;

    // 親要素を取得
    const parentElement = document.getElementById(parent);

    // 新しいp要素を親要素に追加
    parentElement.appendChild(newParagraph);
}

function createCheckbox(containerId, id, labelText, isChecked) {
    const parentElement = document.getElementById(containerId);
    // 新しいチェックボックスを作成
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.id = id;

    // ラベルを作成
    var label = document.createElement('label');

    label.appendChild(document.createTextNode(labelText));

    // 親要素に追加
    parentElement.appendChild(label);
    parentElement.appendChild(checkbox);
}

function createSelectElement(containerId, label, options) {
    // コンテナ要素を取得
    const container = document.getElementById(containerId);

    // 新しいセレクト要素を作成
    const select = document.createElement('select');

    // セレクト要素にIDを設定
    select.id = label;

    // オプションを追加
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.id;
        optionElement.text = option.label;
        select.appendChild(optionElement);
    });

    // コンテナにセレクト要素を追加
    container.appendChild(select);
}

function generateEmptyArray(rows, columns, start) {
    const resultArray = [];

    for (let i = 0; i < rows; i++) {
        const row = [start];
        ++start
        for (let j = 0; j < columns; j++) {
            row.push(" ");
        }

        resultArray.push(row);
    }

    return resultArray;
}

function checkArrayContains(inputArray, targetArray) {
    // 入力と目標の各要素が一致するか確認
    for (let targetItem of targetArray) {
        // いずれかの入力要素が目標要素と一致すればtrueを返す
        if (inputArray.some(inputItem => inputItem.includes(targetItem))) {
            continue;
        } else {
            // 一致しない場合はfalseを返す
            return false;
        }
    }

    // 全ての目標要素が一致した場合はtrueを返す
    return true;
}


function formatTime(seconds) {
    seconds = Math.round(seconds * 10000) / 10000; // 小数点4桁で四捨五入

    if (seconds < 60) {
        return seconds.toFixed(4) + "秒";
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = (seconds % 60).toFixed(4);
        return minutes + "分" + (remainingSeconds > 0 ? remainingSeconds + "秒" : "");
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = (seconds % 60).toFixed(4);
        let result = hours + "時間";
        if (remainingMinutes > 0) {
            result += remainingMinutes + "分";
        }
        if (remainingSeconds > 0) {
            result += remainingSeconds + "秒";
        }
        return result;
    } else if (seconds < 2592000) { // 1ヶ月は約30日と仮定
        const days = Math.floor(seconds / 86400);
        const remainingHours = Math.floor((seconds % 86400) / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = (seconds % 60).toFixed(4);
        let result = days + "日";
        if (remainingHours > 0) {
            result += remainingHours + "時間";
        }
        if (remainingMinutes > 0) {
            result += remainingMinutes + "分";
        }
        if (remainingSeconds > 0) {
            result += remainingSeconds + "秒";
        }
        return result;
    } else if (seconds < 31536000) { // 1年は約365.25日と仮定（うるう年考慮）
        const days = Math.floor(seconds / 86400);
        const remainingHours = Math.floor((seconds % 86400) / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = (seconds % 60).toFixed(4);
        let result = days + "日";
        if (remainingHours > 0) {
            result += remainingHours + "時間";
        }
        if (remainingMinutes > 0) {
            result += remainingMinutes + "分";
        }
        if (remainingSeconds > 0) {
            result += remainingSeconds + "秒";
        }
        return result;
    } else {
        const years = Math.floor(seconds / 31536000); // 1年は約365.25日と仮定（うるう年考慮）
        const remainingDays = Math.floor((seconds % 31536000) / 86400);
        const remainingHours = Math.floor((seconds % 86400) / 3600);
        const remainingMinutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = (seconds % 60).toFixed(4);
        let result = years + "年";
        if (remainingDays > 0) {
            result += remainingDays + "日";
        }
        if (remainingHours > 0) {
            result += remainingHours + "時間";
        }
        if (remainingMinutes > 0) {
            result += remainingMinutes + "分";
        }
        if (remainingSeconds > 0) {
            result += remainingSeconds + "秒";
        }
        return result;
    }
}

function add0xIfNeeded(input) {
    // 先頭が"0x"で始まっていない場合のみ追加
    if (!/^0x/i.test(input)) {
        input = "0x" + input;
    }
    return input;
}