function select_genre (element) {
	var dict = url_resolve();
	// если мы отметили ранее не отмеченный элемент, то
	// добавляем в словарь новое значение, иначе - удаляем старое
	console.log(dict);
	if (element.checked) {
		console.log(element.id);
		var elem = element.id.split(":");
		if (dict[elem[0]].indexOf(elem[1]) == -1)
			dict[elem[0]].push(elem[1]);
	} else {
		var elem = element.id.split(":");
		console.log(dict);
		console.log(elem);
		// удаляем элемент, с которого снято выделение
		dict[elem[0]] = dict[elem[0]].filter(function(element) {
			return decodeURIComponent(element) != elem[1];
		});
		console.log(dict);
	}
	window.location.href = construct_url(dict);
}
function update_checkboxes(dict) {
	//var elements = $("");
	for (var i in dict['old_limit']) {
		var selector = "old_limit:" + dict['old_limit'][i];
		document.getElementById(selector).checked = true;
		//$("#old_limit:" + dict['old_limit'][i]).attr("checked", true);
	}
	for (var i in dict['genres']) {
		var selector = '#genres:' + dict['genres'][i];
		selector = "genres:" + dict['genres'][i];
		document.getElementById(decodeURIComponent(selector)).checked = true;
	}
}
function url_resolve() {
	// сначала получаем в форме словаря текущий урл
	// (в словарь проще добавить в нужное место изменения)
	var keys = ['old_limit', 'genres'];	// добавлять по мере надобности новые категории
	var current_url = document.location.pathname;
	var dict = {};
	var arr = current_url.split("/").slice(3);
	if (arr.length == 0) {
		// обрабатываем ситуацию, когда фильтры ещё не применялись
		dict['old_limit'] = [];
		dict['genres'] = [];
	} else {
		// ситуация, когда либо жанров, либо рейтинга нет
		// тогда мы добавляем их
		arr = arr.filter(function(element) {
			return element;
		});
		for (var i = 0; i < arr.length; i += 2) {
			dict[arr[i]] = arr[i + 1].split(",");
		}
		for (var i in keys) {
			if (!(keys[i] in dict))
				dict[keys[i]] = [];
		}
	}
	return dict;
}
function show_menu () {
	var global_menu = $("#global_menu");
	if (global_menu.css("display") == "none")
		global_menu.css("display", "block");
	else
		global_menu.css("display", "none");
}
function show_panel() {
	var left_menu = $("#left_menu");
	if (left_menu.css("display") == 'none') {
		left_menu.css("display", 'block');
		$("main").css("right", "11.6em");
	} else {
		left_menu.css("display", "none");
		$("main").css("right", "0");
	}
}

function construct_url(dict) {
	// конструируем новый url (позже сделать его универсальным)
	// на основе старого + изменения
	var category = window.location.pathname.split("/")[1];
	var new_url = '/' + category + '/filter/';
	for (var key in dict) {
		if (dict[key].length) {
			new_url += key + '/';
			for (var i in dict[key]) {
				new_url +=  dict[key][i] + ','
			}
			new_url = new_url.slice(0, new_url.length - 1) + '/';
		}
	}
	if (new_url == '/' + category + '/filter/')
		new_url = '/' + category;
	return new_url;
}