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