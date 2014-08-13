var defaultApp = angular.module('defaultApp', [
	'ngCookies',
    'angularFileUpload',
    'ngQuickDate'
]);

defaultApp.directive('ngThumb', ['$window', function($window) {
        var helper = {
            support: !!($window.FileReader && $window.CanvasRenderingContext2D),
            isFile: function(item) {
                return angular.isObject(item) && item instanceof $window.File;
            },
            isImage: function(file) {
                var type = '|' + file.type.slice(file.type.lastIndexOf('/') + 1) + '|';
                return '|jpg|png|jpeg|bmp|gif|'.indexOf(type) !== -1;
            }
        };

        return {
            restrict: 'A',
            template: '<canvas/>',
            link: function(scope, element, attributes) {
                if (!helper.support) return;

                var params = scope.$eval(attributes.ngThumb);

                if (!helper.isFile(params.file)) return;
                if (!helper.isImage(params.file)) return;

                var canvas = element.find('canvas');
                var reader = new FileReader();

                reader.onload = onLoadFile;
                reader.readAsDataURL(params.file);

                function onLoadFile(event) {
                    var img = new Image();
                    img.onload = onLoadImage;
                    img.src = event.target.result;
                }

                function onLoadImage() {
                    var width = params.width || this.width / this.height * params.height;
                    var height = params.height || this.height / this.width * params.width;
                    canvas.attr({ width: width, height: height });
                    canvas[0].getContext('2d').drawImage(this, 0, 0, width, height);
                }
            }
        };
}]);


defaultApp.config(function ($interpolateProvider) {
	$interpolateProvider.startSymbol('{[{');
	$interpolateProvider.endSymbol('}]}');
});

defaultApp.controller('DefaultCtrl', ['$scope', '$http', '$location', '$window',
	function ($scope, $http, $location, $window) {
		$scope.hidden_menu = false;
		$scope.visibility_form = false;
		$scope.visibility_user = false;
        $scope.username = $window.localStorage.username;
        $scope.token = $window.localStorage.token;

        var url = $window.location.pathname.split('/');
        $scope.headers = [{'name': 'A', 'url': '/'}];
        if (url[1])
            $scope.headers.push({'name': ' > ' + url[1], 'url': '/' + url[1]});
        if (url.indexOf('filter') == -1) {
            if (url[2] && url[2] != 'list')
                $scope.headers.push({'name': ' > Product', 'url': '/' + [url[1], url[2]].join('/')});
            if (url[3])
                $scope.headers.push({'name': ' > ' + url[3], 'url': window.location.pathname});
        }

		$scope.show_menu = function () {
			$scope.hidden_menu = !$scope.hidden_menu;
		};

		$scope.show_user_menu = function () {
			$scope.visibility_user = true;
		};

		$scope.hide_user_menu = function () {
			$scope.visibility_user = false;
		};

        // Это очень редко меняющийся контент, поэтому храним в localStorage
        if (!$window.localStorage.raiting) {
            $http.get('/api/raitings').success(function (data) {
                $scope.raiting = data;
                $window.localStorage['raiting'] = JSON.stringify(data.results);
            });
        }
        if (!$window.localStorage.category_groups) {
            $http.get('/api/categories').success(function (data) {
                $scope.category_group = data.results;
                var result = [];
                for (var i in data.results)
                    for (var j in data.results[i].categories)
                        result.push(data.results[i].categories[j]);
                $window.localStorage['category_groups'] = JSON.stringify($scope.category_group);
                $window.localStorage['categories'] = JSON.stringify(result);
            });
        } else {
            $scope.category_group = JSON.parse($window.localStorage['category_groups']);
        }

        $scope.logout = function () {
            $window.localStorage.removeItem('token');
            $window.localStorage.removeItem('username');
            $window.location.pathname = $window.location.pathname;
        };

		$scope.auth_me = function () {
            var url = $location.absUrl();
            var data = "username=" + $scope.auth['username'] + "&password=" + $scope.auth['password'];
            $http.post('/api-token-auth/', {
                username: $scope.auth['username'],
                password: $scope.auth['password']
            }, {
                headers:{
                    'Content-Type': 'application/json'
                }
            }).success(function (data) {
                $window.localStorage['token'] = data['token'];
                $window.localStorage['username'] = $scope.auth['username'];
                $window.location.pathname = $window.location.pathname;
            });
		};

		$scope.login = function () {
			$scope.visibility_form = !$scope.visibility_form;
		};
		$scope.searcher = function () {
            if ($scope.search_data.length > 1)
                $http.get('/api/search?product=' + $scope.search_data).success(function (data) {
                    $scope.search_result = data.results;
                });
            else
                $scope.search_result = [];
		};
	}
]);

/*
	Список продуктов конкретной категории
*/
defaultApp.controller('ListCtrl', ['$scope', '$http', '$location', 'FileUploader',
	function ($scope, $http, $location, FileUploader) {
		$scope.panel_visibility = false;
		$scope.edit_visibility = false;
		$scope.add_form_visible = false;

		$scope.uploader = new FileUploader();
		$scope.uploader.queueLimit = 1;
		$scope.uploader.removeAfterUpload = true;
        $scope.main_check = true;

		$scope.active_genres = {};
		$scope.active_limits = {};

        $scope.product_genres = {};

        $scope.token = localStorage.token;

        // Переход на вторую страницу формы
        $scope.main_checked = function () {
            if (!$scope.product || !$scope.product.title) {
                alert('Enter title')
            }else if (!$scope.product.description) {
                alert('Enter description')
            } else if (!$scope.product.old_limit)
                alert('Enter Old Limit, please');
            else if (!$scope.uploader.queue[0])
                alert('Load image, please');
            else
                $scope.main_check = !$scope.main_check;
        };

        $scope.select_genre = function (genre, product) {
            $scope.product_genres['' + genre.id] = genre.name;
        };

        var limits = $location.absUrl().split('/').slice(5).map(function (data) {
            return data.replace('%20', ' ', 'g');
        });
		var lims = [];
		var genres = [];
				
		if (limits.indexOf('old_limit') != -1)
			lims = limits[limits.indexOf('old_limit') + 1].split(',');
		if (limits.indexOf('genres') != -1)
			genres = limits[limits.indexOf('genres') + 1].split(',');
		
		for (var i in lims)
			$scope.active_limits[lims[i]] = true;
		for (var i in genres)
			$scope.active_genres[genres[i]] = true;

		var category = $location.absUrl().split('/');
		category = category[3] + '/';
        var categories = JSON.parse(localStorage['categories']);
        for (var i in categories)
            if (categories[i].url == category) {
                $scope.category_id = categories[i].id;
                category = categories[i].id;
                break;
            }

		$scope.mouse_over = function (elem) {
			elem.product.edit_btn = true;
		};

		$scope.mouse_leave = function (elem) {
			elem.product.edit_btn = false;
		};

		$scope.show_edit_form = function (elem, $event) {
			$scope.add_form_visible = true;
			$scope.product = elem.product;
            $scope.editing_product = true;
			$event.preventDefault();
		};

        var url = '/api/genres?category=' + category;
        var g = Object($scope.active_genres).keys;
        if (genres)
            url += '&genres=' + genres;

		$http.get(url).success(function (data) {
			$scope.genre_groups = data.results;
            $scope.genre_groups1 = data.results;
			$scope.all_genres = [];
            $scope.dict_genres = {};
			for (var i in data.results)
				for (var j in data.results[i].genres) {
					$scope.all_genres.push(data.results[i].genres[j]);
                    $scope.dict_genres['' + data.results[i].genres[j].id] = data.results[i].genres[j].name;
					if (genres.indexOf(data.results[i].genres[j].name) != -1)
						$scope.genre_groups[i].genres[j].checked = true;
					else
						$scope.genre_groups[i].genres[j].checked = false;
				}
		});

		$http.get('/api/raitings').success(function (data) {
			$scope.raiting = data.results;
			for (var i in data.results) {
				if (lims.indexOf(data.results[i].name) != -1)
					$scope.raiting[i].checked = true;
				else
					$scope.raiting[i].checked = false;
			}
		});

        /* DANGEROUS!!!: НЕ ВЛЕЗАЙ, УБЬЁТ */
		$scope.start_filter = function (elem) {
			// По нажатию на флажок - фиксируем активный элемент
			if (elem.genre)
				$scope.active_genres[elem.genre.name] = !$scope.active_genres[elem.genre.name];

			if (elem.old_limit)
				$scope.active_limits[elem.old_limit.name] = !$scope.active_limits[elem.old_limit.name];
			var next_url = '/filter';

			// Удаляем элемнты, равные false
			var tmp = Object.keys($scope.active_limits).filter(function (elem) {
				return $scope.active_limits[elem];
			});
			// Если елементы ещё остались - заносим их в схему url'a
			if (tmp.length > 0) {
				next_url += '/old_limit/';
				for (var i in tmp)
					next_url += tmp[i] + ',';
				next_url = next_url.slice(0, next_url.length - 1);
			}
			tmp = Object.keys($scope.active_genres).filter(function (elem) {
				return $scope.active_genres[elem];
			});
			if (tmp.length > 0) {
				next_url += '/genres/';
				for (var i in tmp)
					next_url += tmp[i] + ',';
				next_url = next_url.slice(0, next_url.length - 1);
			}
			if (next_url == '/filter')
				next_url = '';
			window.location.href = $location.absUrl().split('/').slice(0, 4).join('/') + next_url + '/';
		};

		var url = $location.absUrl().split('/').slice(3).join('/');

		$scope.remove_image = function () {
			$scope.uploader.removeFromQueue(0);
		};

		$http.get('/api/products/category:' + url).success(function (data) {
			$scope.products = data.results;
            $scope.pages = [];
			for (var i in data.results) {
				$scope.products[i].avatar = "/media/" + data.results[i].avatar.split('/').pop();
				$scope.products[i].edit_btn = false;
			}
		});

		$scope.show_panel = function () {
			$scope.panel_visibility = !$scope.panel_visibility;
		};
		
		$scope.add_form = function () {
			$scope.add_form_visible = !$scope.add_form_visible;
		};

		$scope.add_to_list = function (elem, $event, user_list) {
            // Добавление продукта со страницы списка
			$http({
				method: "POST",
				url: "/api/userlist/product:" + elem.product.id,
				data: "name=Planned",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": 'Token ' + localStorage.token
				}
			}).success(function (data) {
                data['status'] = 'Planned';
                user_list[data['product']] = data;
            });
			$event.preventDefault();
		};

        if ($scope.token) {
            $http.get('/api/userlist?category=' + category, {
                headers: {'Authorization': 'Token ' + localStorage.token}
            }).success(function (data) {
                var statuses = ["", "Planned", "Watch", "ReWatching", "Watched", "Deffered", "Dropped"];
                $scope.user_list = {};
                for (var i in data.results) {
                    var key = '' + data.results[i].product;
                    data.results[i].status = statuses[data.results[i].status];
                    $scope.user_list[key] = data.results[i];
                }
            });
        }


		$scope.add_product = function () {
			$scope.product['category'] = $scope.category_id;
            $scope.product['genres'] = Object.keys($scope.product_genres).map(function (item) {
                return Number.parseInt(item);
            });
            $scope.uploader.onSuccessItem = function (item, response, status, headers) {
                $scope.editing_product = false;
                window.location.pathname = window.location.pathname;
            }
            if ($scope.editing_product) {
                $scope.uploader.queue[0].method = "PUT";
                $scope.uploader.queue[0].url = '/api/products/id:' + $scope.product.id;
            } else {
			    $scope.uploader.queue[0].url = "/api/products";
            }
			$scope.uploader.queue[0].alias = "avatar";
            $scope.uploader.queue[0].headers = {'Authorization': 'Token ' + $scope.token};
			$scope.uploader.queue[0].formData.push({'data': JSON.stringify($scope.product)});
			$scope.uploader.uploadAll();
		};
	}
]);

/*
	Отображает описание продукта
*/
defaultApp.controller('DetailCtrl', ['$scope', '$http', '$location', '$window', 'FileUploader',
	function ($scope, $http, $location, $window, FileUploader) {
		$scope.statuses = ['Add To List', 'Planned', 'Watch', 'ReWatching', 'Watched', 'Deffered', 'Dropped'];
        $scope.token = $window.localStorage['token'];
        $scope.uploader = new FileUploader();
        $scope.product_genres = {};

		var id = window.location.pathname.split('/')[2].split('-')[0];

        $scope.main_check = true;

        $scope.main_checked = function () {
            $scope.main_check = !$scope.main_check;
        };

		$http.get('/api/products/id:' + id).success(function (data) {
			$scope.product = data;
		});

        $http.get('/api/userlist?product=' + id, {
            headers: {'Authorization': 'Token ' + $scope.token}
        }).success(function(data) {
            if (data.results[0])
                $scope.active_status = $scope.statuses[data.results[0].status];
        });

        $scope.add_form = function () {
            $scope.add_form_visible = !$scope.add_form_visible;
        };

        var product_url = window.location.pathname.split('/');
        var p_url = product_url.slice(0, product_url.length - 2).join('/');
        if (product_url[product_url.length - 2] != 'series')
            p_url = product_url.slice(0, product_url.length - 1).join('/');
        $scope.contents = [
			{'name': 'Description', 'url': p_url},
			{'name': 'Series', 'url': p_url + '/series'},
			{'name': 'Heroes', 'url': p_url + '/heroes'},
			{'name': 'Creators', 'url': p_url + '/creators'}
		];
		$http.get('/api/genres').success(function (data) {
			$scope.genres = data;
		});

		$scope.category = window.location.pathname.split('/')[1];
        $scope.raiting = JSON.parse($window.localStorage['raiting']);

        // Смена статуса продукта
        $scope.status_move = function (elem, active_status) {
            var metod = 'POST'
            if (active_status)
                metod = "PUT";
            if (elem.status != $scope.statuses[0])
                $http({
                    method: metod,
                    url: "/api/userlist/product:" + id,
                    data: "name=" + elem.status,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Token ' + $scope.token
                    }
                });
        };

        $scope.change_num_series = function () {
            $http({
                method: 'PUT',
                url:'/api/serielist/product:' + id + '/count',
                data: 'series=' + $scope.readed_series,
                headers: {
                    'Authorization': 'Token ' + window.localStorage.token,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }).success(function (data) {
            });
        };

		var category = $location.absUrl().split('/');
		category = category[3] + '/';
        var categories = JSON.parse(localStorage['categories']);
        for (var i in categories)
            if (categories[i].url == category) {
                $scope.category_id = categories[i].id;
                category = categories[i].id;
                break;
            }

        $scope.select_genre = function (genre, product) {
            $scope.product_genres['' + genre.id] = genre.name;
        };

		$http.get('/api/genres?category=' + category).success(function (data) {
			$scope.genre_groups = data.results;
			$scope.all_genres = [];
            $scope.dict_genres = {};
			for (var i in data.results)
				for (var j in data.results[i].genres) {
					$scope.all_genres.push(data.results[i].genres[j]);
                    $scope.dict_genres['' + data.results[i].genres[j].id] = data.results[i].genres[j].name;
                    if ($scope.product.genres.indexOf(data.results[i].genres[j].id) != -1)
                        $scope.genre_groups[i].genres[j].checked = true;
                    else
                        $scope.genre_groups[i].genres[j].checked = false;
				}
		});

        $http.get('/api/seasons?product=' + id, { headers: {
            'Authorization': 'Token ' + $scope.token
        }}).success(function (data) {
			$scope.seasons = data.results;
			var count = 0;
			for (var i in data.results)
				for (var j in data.results[i].series) {
					count++;
					if (!data.results[i].series[j]['length'])
						$scope.seasons[i].series[j]['length']= " ";
					if (data.results[i].series[j].start_date) {
						var tmp = data.results[i].series[j].start_date.slice(0, 10)
						$scope.seasons[i].series[j].start_date = tmp;
					}
				}
			$scope.count_series = count;
		});

		$scope.edit_product = function () {
			$scope.product['category'] = $scope.category_id;
            $scope.product['genres'] = Object.keys($scope.product_genres).map(function (item) {
                return Number.parseInt(item);
            });
            $scope.uploader.onSuccessItem = function (item, response, status, headers) {
                window.location.pathname = window.location.pathname;
            }
            $scope.uploader.queue[0].method = "PUT";
			$scope.uploader.queue[0].alias = "avatar";
            $scope.uploader.queue[0].headers = {'Authorization': 'Token ' + $scope.token};
			$scope.uploader.queue[0].formData.push({'data': JSON.stringify($scope.product)});
			$scope.uploader.queue[0].url = "/api/products/id:" + $scope.product.id;
			$scope.uploader.uploadAll();
		};

        // Создание нового сезона
        $scope.create_season = function () {
			$http({
				method: "POST",
				url: "/api/seasons",
				data: "product=" + id,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Token ' + $scope.token
				}
			}).success(function (data) {
				$scope.seasons.unshift(data);
			});
		};

        $scope.serie_mouse_enter = function (serie) {
			serie.edit = true;
		};

		$scope.serie_mouse_leave = function (serie) {
			serie.edit = false;
		};

		$scope.show_menu = function (serie) {
			serie.menu = !serie.menu;
		};

        // Добавление новой серии
		$scope.create_serie = function (season) {
			// Добавляем отсутсвующий ноль
			var start_date = season.new_serie.start_date.toLocaleString().split(' ').join(' 0') || "";

			var data = "number=" + season.new_serie.number + "&name=" + season.new_serie.name +
				"&start_date=" + start_date + "&length=" + season.new_serie.length;
			data = data.replace("undefined", "", "g");
			data += "&season=" + season.id;
			$http({
				method: "POST",
				url: "/api/series",
				data: data,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Token ' + $scope.token
				}
			}).success(function (data) {
                data.start_date = data.start_date.slice(0, 10);
                season.series.unshift(data);
			});
		};

        $scope.edit_serie = function (serie) {}

        $scope.add_to_list_serie = function (serie) {
            $http({
                method: "POST",
                url: "/api/serielist",
                data: "serie=" + serie.id + "&product=" + id,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Token ' + $scope.token
                }
            }).success(function (data) {
                $scope.readed_series++;
                $scope.serielist['' + data.serie] = data;
            });
        };

        $scope.del_from_list_serie = function (serie, serielist) {
            $http({
                method: "DELETE",
                url: "/api/serielist/serie:" + serie.id,
                data: "",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Token ' + $scope.token
                }
            }).success(function (data) {
                delete serielist[serie.id];
                $scope.readed_series--;
            });
        };

        $scope.show_editing = function (serie) {
            serie.new_version = {number: serie.number, name: serie.name, start_date: serie.start_date, length: serie.length};
            serie.editing = !serie.editing;
        };

        $http.get('/api/serielist?user=' + localStorage.username + '&product=' + id, {headers: {
            'Authorization': 'Token ' + $scope.token
        }}).success(function (data) {
            console.log(data);
            $scope.readed_series = data.count;
            $scope.readed_series_old = data.count;
            var tmp = {};
            for (var i in data.results)
                tmp['' + data.results[i]['serie']] = data;
            $scope.serielist = tmp;
        });

        // Редактирование серии
        $scope.submit_serie = function (serie) {
            var start_date = serie.new_version.start_date.toLocaleString().split(' ').join(' 0') || "";
            var data = "number=" + serie.new_version.number + "&name=" + serie.new_version.name + "&start_date=" +
                start_date + "&length=" + serie.new_version.length + "&season=" + serie.season_id;
            $http({
                method: "PUT",
                url: "/api/series/id:" + serie.id,
                data: data,
                headers: {
                    'Authorization': 'Token ' + localStorage.token,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }).success(function (data) {
                serie.editing = false;
                serie.number = data.number;
                serie.name = data.name;
                serie.start_date = data.start_date.slice(0, 10);
                serie['length'] = serie.new_version['length'];
                serie.new_version = None;
            });
        };
	}
]);


defaultApp.controller('ProfileController', ['$scope', '$http', '$window',
    function ($scope, $http, $window) {
        $http.get('/api/profile', {headers: {
            'Authorization': 'Token ' + $window.localStorage.token
        }}).success(function (data) {
            $scope.user_list = data;
        });
    }]);

defaultApp.controller('UserCtrl', ['$scope', '$http',
    function ($scope, $http) {
        $scope.statuses = ['', 'Planned', 'Watch', 'ReWatching', 'Watched', 'Deffered', 'Dropped'];
        $scope.statuses_lower = ['', 'planned', 'watch', 'rewatching', 'watched', 'deffered', 'dropped'];
        var arr = window.location.pathname.split('/');
        var category = arr[3];
        var status = $scope.statuses_lower.indexOf(arr[4]);

        $http.get('/api/userlist?status=' + status + '&category=' + category, {headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Token ' + localStorage.token
        }}).success(function (data) {
            $scope.user_list = data.results;
        });

        $scope.status_move = function (product, status) {};
    }]);


defaultApp.controller('CreatorController', ['$scope', 'FileUploader', '$http',
    function ($scope, FileUploader, $http) {
        $scope.add_form_visible = false;
        $scope.uploader = new FileUploader();
        var id = window.location.pathname.split('/')[2].split('-')[0];

        $scope.add_form = function () {
            $scope.add_form_visible = !$scope.add_form_visible;
        };

        $http.get('/api/serielist?user=' + localStorage.username + '&product=' + id, {headers: {
            'Authorization': 'Token ' + $scope.token
        }}).success(function (data) {
            console.log(data);
            $scope.readed_series = data.count;
            $scope.readed_series_old = data.count;
            var tmp = {};
            for (var i in data.results)
                tmp['' + data.results[i]['serie']] = data;
            $scope.serielist = tmp;
        });

        $scope.remove_image = function () {
            $scope.uploader.removeFromQueue(0);
        };

        $http.get('/api/creators?product=' + id).success(function (data) {
            $scope.creators = data.results;
        });

        $http.get('/api/employs').success(function (data) {
            $scope.employers = data.results;
            $scope.employs = [];
        });

        $scope.select_creator = function (creator) {
            $scope.searched_creator = creator;
            $scope.search_creator.name = creator.name;
            $scope.search_creators = [];
        };

        $scope.enter_creator_name = function () {
            if ($scope.search_creator.name.length > 1)
                $http.get('/api/search_creator?creator=' + $scope.search_creator.name).success(function (data) {
                    $scope.search_creators = data.results;
                });
            else {
                $scope.search_creators = [];
            }
        }

        $scope.filter_employs = function (employ) {
            $scope.employs = $scope.employers.filter(function (data) {
                return data.name.search('^.*' + employ + '.*', 'i') != -1;
            });
        };

        $scope.select_employ = function (employ) {
            $scope.creator.employ = employ.name;
            $scope.employs = [];
        };

        var product_url = window.location.pathname.split('/');
        product_url = product_url.slice(0, product_url.length - 2).join('/');
        $scope.contents = [
			{'name': 'Description', 'url': product_url},
			{'name': 'Series', 'url': product_url + '/series'},
			{'name': 'Heroes', 'url': product_url + '/heroes'},
			{'name': 'Creators', 'url': product_url + '/creators'}
		];
        $scope.statuses = ['Add To List', 'Planned', 'Watch', 'ReWatching', 'Watched', 'Deffered', 'Dropped'];

        $scope.add_creator = function () {
            // если мы заполнили нового персонажа
            if ($scope.creator.name) {
                $scope.creator.product = id;
                for (var i in $scope.employers)
                    if ($scope.employers[i].name == $scope.creator.employ)
                        $scope.creator.employ = $scope.employers[i].id;
                console.log($scope.creator.employ);
                $scope.uploader.queue[0].alias = "avatar";
                $scope.uploader.onSuccessItem = function (item, response, status, headers) {
                    window.location.pathname = window.location.pathname;
                }
                $scope.uploader.queue[0].headers = {'Authorization': 'Token ' + window.localStorage.token};
                $scope.uploader.queue[0].formData.push($scope.creator);
                $scope.uploader.queue[0].url = "/api/creators";
                $scope.uploader.uploadAll();
                window.location.pathname = window.location.pathname;
            } else {
                for (var i in  $scope.employers)
                    if ($scope.employers[i].name == $scope.creator.employ)
                        $scope.creator.employ = $scope.employers[i].id;
                $http({
                    method: "POST",
                    url: '/api/products/id:' + id + '/creators',
                    data: 'id=' + $scope.searched_creator.id + "&employ=" + $scope.creator.employ,
                    headers: {
                        'Authorization': 'Token ' + window.localStorage.token,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }).success(function (data) {
                    window.location.pathname = window.location.pathname;
                });
            }
        };
    }]
);

defaultApp.controller('HeroController', ['$scope', 'FileUploader', '$http',
    function ($scope, FileUploader, $http) {
        var product_url = window.location.pathname.split('/');
        var p_url = product_url.slice(0, product_url.length - 2).join('/');
        $scope.uploader = new FileUploader();
        var id = window.location.pathname.split('/')[2].split('-')[0];
        $scope.contents = [
			{'name': 'Description', 'url': p_url},
			{'name': 'Series', 'url': p_url + '/series'},
			{'name': 'Heroes', 'url': p_url + '/heroes'},
			{'name': 'Creators', 'url': p_url + '/creators'}
		];

        $scope.add_form_visible = false;
        $scope.uploader = new FileUploader();
        var id = window.location.pathname.split('/')[2].split('-')[0];

        $scope.add_form = function () {
            $scope.add_form_visible = !$scope.add_form_visible;
        };

        $scope.remove_image = function () {
            $scope.uploader.removeFromQueue(0);
        };

        $http.get('/api/serielist?user=' + localStorage.username + '&product=' + id, {headers: {
            'Authorization': 'Token ' + $scope.token
        }}).success(function (data) {
            console.log(data);
            $scope.readed_series = data.count;
            $scope.readed_series_old = data.count;
            var tmp = {};
            for (var i in data.results)
                tmp['' + data.results[i]['serie']] = data;
            $scope.serielist = tmp;
        });

        $scope.select_actor = function (h) {
            $scope.hero.actor = h.id;
            $scope.actors = [];
            $scope.hero.actor_name = h.name;
        };

        $scope.change_hero = function (hero_name) {
            // поиск имени "героя"
//            if (hero_name.length > 1) {
//                $http.get('/api/search_hero?hero=' + hero_name).success(function (data) {
//                    $scope.heroes = data.results;
//                });
//            } else {
//                $scope.heroes = [];
//            }
        };

        $scope.change_actor = function (actor_name) {
            if (actor_name.length > 1) {
                $http.get('/api/search_creator?creator=' + actor_name).success(function (data) {
                    $scope.actors = data.results;
                });
            } else {
                $scope.actors = [];
            }
        };

        $http.get('/api/heroes?product=' + id).success(function (data) {
            $scope.heroes = data.results;
        });
        $scope.statuses = ['Add To List', 'Planned', 'Watch', 'ReWatching', 'Watched', 'Deffered', 'Dropped'];

        $scope.submit_hero = function () {
            $scope.hero.product = id;
            $scope.hero.actors = $scope.hero.actor;
            console.log($scope.hero);
            $scope.uploader.queue[0].alias = "avatar";
            $scope.uploader.onSuccessItem = function (item, response, status, headers) {
                window.location.pathname = window.location.pathname;
            }
            $scope.uploader.queue[0].headers = {'Authorization': 'Token ' + window.localStorage.token};
            $scope.uploader.queue[0].formData.push($scope.hero);
            $scope.uploader.queue[0].url = "/api/heroes";
            $scope.uploader.uploadAll();
        }
    }]);