window_load();
var setInterval;
var a=0;
window.onresize = window_load;
function window_load(){
	if(window.innerWidth<200&&window.innerHeight<200){
		document.getElementById("text").innerHTML="専門者凄い(確信)";/**実はAjaxを使用して鯖からテキストファイルを取得したかったが色々あって断念**/
	}else{
		document.getElementById("text").innerHTML="<h3>ヒント</h3>画面サイズを縦200 横200以下して表示しよう!<br /><br /><h4>Error<h4>このページを表示する条件に満たしていません。<br />条件を合わせて、もう一度アクセスしてください。";
	}
}
