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
    selectElement.addEventListener('input', saveInputValuesToURL);
    // dropdown-containerにselect要素とspan要素を追加
    dropdownContainer.appendChild(selectElement);
    dropdownContainer.appendChild(spanElement);

    // .dropdown内にdropdown-containerを追加
    const dropdown = document.querySelector(".dropdown");
    dropdown.appendChild(dropdownContainer);

    // カウンターをインクリメント
    dropdownCounter++;
}
