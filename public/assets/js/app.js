// 客户端
var app = angular.module('chatRoom', []);
app.factory('socket', function($rootScope) {
		//默认连接部署网站的服务器
		var socket = io();
		return {
			on: function(eventname, callback) {
				socket.on(eventname, function() {
					// arguments是函数内部的类数组对象
					var args = arguments;
					//手动执行 脏值检查
					$rootScope.$apply(function() {
						callback.apply(socket, args);
					})
				});
			},
			emit: function(eventname, data, callback) {
				socket.emit(eventname, data, function() {
					var args = arguments;
					$rootScope.$apply(function() {
						if (callback) {
							callback.apply(socket, args);
						}
					});
				})
			}
		}
	})
	// 生成随机色
app.factory('randomColor', function($rootScope) {
		return {
			newColor: function() {
				// <<0 左移运算符中的等同于取证 
				return '#' + ('00000' + (Math.random() * 0x1000000 << 0).toString(16)).slice(-6);
			}
		}
	})
	// 获得某位用户
app.factory('userService', function($rootScope) {
	return {
		get: function(users, nickname) {
			if (users instanceof Array) {
				for (var i = 0; i < users.length; i++) {
					if (users[i].nickname == nickname) {
						return users[i];
					}
				}
			} else {
				return null;
			}
		}
	}
})
app.controller('chatCtrl', ['$scope', 'socket', 'randomColor', 'userService', function($scope, socket, randomColor, userService) {
		var messageWrapper = $('.message-wrapper');
		$scope.haslogined = false; // 默认是“登录页面”
		$scope.receiver = ''; // 默认是群聊
		//  聊天消息放在数组中
		$scope.publicMessages = []; // 群聊消息
		$scope.privateMessages = []; // 私聊消息
		$scope.messages = $scope.publicMessages; // default 默认显示群聊消息
		$scope.users = []; // 存储用户 启动时，用户为空 
		$scope.color = randomColor.newColor(); // 当前用户颜色
		// 登录聊天室
		$scope.login = function() {
			// 客户端向服务器端广播addUser事件 
			socket.emit('addUser', {
				nickname: $scope.nickname,
				color: $scope.color
			})
		};
		// 聊天记录 返回顶部
		$scope.scrollToBottom = function() {
			messageWrapper.scrollTop(messageWrapper[0].scrollHeight);
		};
		// 发送新消息
		$scope.postMessage = function() {
			// 发送的信息
			var msg = {
				text: $scope.words,
				// 消息类型 为 normal
				type: 'normal',
				color: $scope.color,
				from: $scope.nickname,
				to: $scope.receiver
			};
			var rec = $scope.receiver;
			if (rec) {
				// rec“存在”，私信
				if (!$scope.privateMessages[rec]) {
					$scope.privateMessages[rec] = [];
				}
				$scope.privateMessages[rec].push(msg);
			} else {
				// 群聊
				$scope.publicMessages.push(msg);
			}
			// 清除输入框
			$scope.words = '';
			// 消息 不发送给 自己
			if (rec !== $scope.nickname) {
				// 触发addMessage事件， 放松消息
				socket.emit("addMessage", msg);
				
			}
		};
		$scope.setReceiver = function(receiver) {
			    // 设置消息接收者
				$scope.receiver = receiver;
				if (receiver) {
					if (!$scope.privateMessages[receiver]) {
						$scope.privateMessages[receiver] = [];
					}
					// 设置为私信
					$scope.messages = $scope.privateMessages[receiver];
				} else {
					$scope.messages = $scope.publicMessages;
				}
				var user = userService.get($scope.users, receiver);
				if (user) {
					user.hasNewMessage = false;
				}
			}
			// 接收 服务器 登录结果
		socket.on('userAddingResult', function(data) {
				if (data.result) {
					// 昵称没占用
					$scope.userExisted = false;
					$scope.haslogined = true;
				} else {
					// 昵称被占用
					$scope.userExisted = true;
				}
			})
			//  接收到欢迎新用户消息
		socket.on('userAdded', function(data) {
				if (!$scope.haslogined) {
					return;
				}
				$scope.publicMessages.push({
					text: data.nickname,
					// type为欢迎
					type: "welcome"
				});
				// data中包含昵称 和 颜色
				$scope.users.push(data);
			})
			// 接收到 所有用户 信息
		socket.on('allUser', function(data) {
				if (!$scope.haslogined) {
					return;
				} else {
					$scope.users = data;
				}
			})
			//   
		socket.on('messageAdded', function(data) {
				if (!$scope.haslogined) {
					return;
				}
				if (data.to) {
					// 发给某个特定的人
					if (!$scope.privateMessages[data.from]) {
						$scope.privateMessages[data.from] = [];
					}
					$scope.privateMessages[data.from].push(data);
				} else {
					// 群聊
					$scope.publicMessages.push(data);
				}
				// 获取发送方 接收方
				var fromUser = userService.get($scope.users, data.from);
				var toUser = userService.get($scope.users, data.to);
				if ($scope.receiver !== data.to) { //与来信方不是正在聊天当中才提示新消息
					if (fromUser && toUser.nickname) {
						fromUser.hasNewMessage = true; //私信
					} else {
						toUser.hasNewMessage = true; //群发
					}
				}
			})
			// 在“视图上”删掉下线的用户
		socket.on('userRemoved', function(data) {
			if (!$scope.haslogined) {
				return;
			}
			$scope.publicMessages.push({
				text: data.nickname,
				type: "bye"
			});
			for (var i = 0; i < $scope.users.length; i++) {
				if ($scope.users[i].nickname == data.nickname) {
					$scope.users.splice(i, 1);
					return;
				}
			}
		})
	}])
	//  指令 消息列表
app.directive('message', ['$timeout', function($timeout) {
		return {
			restrict: 'E',
			templateUrl: 'message.html',
			scope: {
				info: '=',  // info属性绑定到 父scope上面
				self: '=',
				scrolltothis: "&"
			},
			link: function(scope, elem, attrs) {
				scope.time = new Date();
				//$timeout service 用法  $timeout([fn], [delay], [invokeApply], [Pass]);
				$timeout(scope.scrolltothis);
				$timeout(function() {
					elem.find('.avatar').css('background', scope.info.color);
				});
			}

		}
	}]) // 哎，$timeout 服务的 名字 少写一个字母，导致折腾了好长时间
	//Declaration this way ensures that services are correctly identified when your JavaScript code gets minified.
	.directive('user', ['$timeout', function($timeout) {
		return {
			restrict: 'E',
			templateUrl: 'user.html',
			scope: {
				info: '=',
				iscurrentreceiver: "=",
				setreceiver: "&"
			},
			link: function(scope, elem, attrs, chatCtrl) {
				$timeout(function() {
					elem.find('.avatar').css('background', scope.info.color);
				});
			}
		}
	}])