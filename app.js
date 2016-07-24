// 服务端

// 创建一个 Express 应用。 express() 是一个由 express 模块导出的入口（top-level）函数。 
var express = require('express');
// 可以理解 app 是一个“函数”
var app = express();

var http = require('http').createServer(app);
var io = require('socket.io')(http);
// express 静态的文件  __dirname node.js 当前代码所在目录   express 中间件生成目录
app.use(express.static(__dirname + '/public'));
// express 路由
app.get('/', function(req, res) {
  res.sendfile('index.html')
});
var connectedSockets = {};
var allusers = [{
  nickname: "",
  color: "#000"
}];
// 监听connection事件
io.on('connection', function(socket) {
      // 用户进入聊天室
  socket.on('addUser', function(data) {
      // data 包含 昵称颜色
      // 判断 昵称 是否重复
      if (connectedSockets[data.nickname]) {
        socket.emit('userAddingResult', {
          result: false
        });
      } else {
        //  昵称 不重复
        socket.emit('userAddingResult', {
          result: true
        });
        // 保存每个socket实例,发私信需要用
        socket.nickname = data.nickname;
        // 昵称对应的socket保存到connetedSockets对象中
        connectedSockets[socket.nickname] = socket;
        // 
        allusers.push(data);
        // 广播欢迎新用户
        socket.broadcast.emit('userAdded', data);
        // 将在线用户发给所有人
        socket.emit('allUser', allusers);
      }

    })
    // 收到 客户端 发送的新消息
  socket.on('addMessage', function(data) {
      if (data.to) {
        // 发送给 某用户
        connectedSockets[data.to].emit('messageAdded', data);
      } else {
        // 广播 发送
        socket.broadcast.emit('messageAdded', data);
      }
    })
    // 用户退出
  socket.on('disconnect', function() {
    //  广播用户退出
    socket.broadcast.emit('userRemoved', {
      nickname: socket.nickname
    });
    for (i = 0; i < allusers.length; i++) {
      if (allusers[i].nickname == socket.nickname) {
        // 数组删除元素
        allusers.splice(i, 1);
      }
    }
    // 删除对应的socket实例
    delete connectedSockets[socket.nickname];
  })
})
// 监听8080端口
http.listen(8080, function() {
  console.log('listening on *:8080');
});