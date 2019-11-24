
function initializeSocketIo(){
   	//make connection
	var socket = io.connect('http://10.0.75.1:8080');

	//buttons and inputs;
	var message = $("#message");
	var send_message = $("#send_message");
	var send_username = $("#send_username");
	var send_reciever_name = $("#recieverip");
	var chatroom = $("#message_room");
	var feedback = $("#feedback");
	var username = localStorage.getItem('usersocketname');

	console.log
	//Emit message
	send_message.click(function(){
		alert("clickd");
		socket.emit('new_message', {message : message.val(),recv : send_reciever_name.val()})
	})

	//Listen on new_message
	socket.on("new_message", (data) => {
		feedback.html('');
		message.val('');
		var divmessage = document.createElement('div');
		if(data.sender_id == username){
			divmessage.className += "d-flex justify-content-start mb-4";
			var content = '<div class="img_cont_msg">\
				<img src="https://static.turbosquid.com/Preview/001292/481/WV/_D.jpg" \
				class="rounded-circle user_img_msg" avatar="'+username+'">\
			</div>\
			<div class="msg_cotainer">\
				'+data.message+'\
				<span class="msg_time">date</span>\
			</div>\
			</div>';
			divmessage.innerHTML = content;
		}else{
			divmessage.className += "d-flex justify-content-end mb-4";

			var content = '<div class="msg_cotainer_send">\
						'+data.message+'\
						<span class="msg_time_send">date</span>\
					</div>\
					<div class="img_cont_msg">\
				<img src="/views/bipul.jpg" class="rounded-circle user_img_msg" avatar="'+data.sender_id+'">\
					</div>\
				</div>';
				divmessage.innerHTML = content;
		}
		chatroom.append(divmessage);
	});

	//Emit a username
	send_username.click(function(){
		socket.emit('change_username', {username : username});
		console.log(username);
	})

	//Emit typing
	message.bind("keypress", () => {
		socket.emit('typing',{id : send_reciever_name.val()})
	})

	//Listen on typing
	socket.on('typing', (data) => {
		feedback.html("<p><i>" + data.username + " is typing a message..." + "</i></p>")
	})
}


