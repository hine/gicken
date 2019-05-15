(function(global) {
    "use strict";

    var RemoteController = function() {
        this._ws = null;

        this._padConnected = false;
        this._gamepadActive = false;
        this._gamepadDetectNumber = 0;
        this._gamepadInUse = 999;

        this._joystickData = {throttle: 0, steering: 0};

        //Create AnimationFrame
        window.requestAnimationFrame(this._gamepadUpdate.bind(this));
        document.getElementById("gamepad").addEventListener("change", function() {
            var gamepadIndex = document.getElementById("gamepad").selectedIndex
            this._gamepadInUse = document.getElementById("gamepad").options[gamepadIndex].value;
            console.log("id:" + document.getElementById("gamepad").options[gamepadIndex].value + "(" + document.getElementById("gamepad").options[gamepadIndex].text + "が選択されました")
        }.bind(this));

        // 制限のためのUIの数値を反映させるイベントリスナー
        document.getElementById("range").addEventListener("input", function () {
            document.getElementById("limitter-value").textContent = document.getElementById("range").value;
            this._saveConfig();
        }.bind(this));

        // リモートコントロールパーツの初期化
        this._initRemoteControl();

        // WebSocketに接続
        var connectParameter = "ws://" + location.host + "/ws";
        console.log(connectParameter);
        this._connect(connectParameter);
    };
    RemoteController.prototype = {
        // Class定数定義
    
        // Class関数定義
        _initRemoteControl: function() {
            this._mouseDown = false;
            document.getElementById("controller").addEventListener("mousedown", function (event) {
                this._mouseDown = true;
                this._changeStickPosition(event);
            }.bind(this));
            document.getElementById("controller").addEventListener("mousemove", function(event) {
                if (this._mouseDown == true) {
                    this._changeStickPosition(event);
                }
            }.bind(this));
            document.getElementById("controller").addEventListener("mouseup", function(event){
                this._mouseDown = false;
                this._resetStickPosition();
                this._sendStickPosition(0, 0);
            }.bind(this));
        },
        _changeStickPosition: function(event) {
            this._stickPositionX = event.offsetX - 150;
            this._stickPositionY = event.offsetY - 150;
            if (this._stickPositionX < -100) {
                this._stickPositionX = -100;
            }
            if (this._stickPositionX > 100) {
                this._stickPositionX = 100;
            }
            if (this._stickPositionY < -100) {
                this._stickPositionY = -100;
            }
            if (this._stickPositionY > 100) {
                this._stickPositionY = 100;
            }
            var top = this._stickPositionY + 100;
            var left = this._stickPositionX + 100;
            document.getElementById("stick-point").style.top = top + "px";
            document.getElementById("stick-point").style.left = left + "px";
            this._setJoystickData(this._stickPositionY, this._stickPositionX);
        },
        _setJoystickData: function(throttle, steering) {
            this._joystickData["throttle"] = throttle;
            this._joystickData["steering"] = steering;
        },
        _resetStickPosition: function() {
            this._stickPositionX = 0;
            this._stickPositionY = 0;
            var top = this._stickPositionY + 100;
            var left = this._stickPositionX + 100;
            document.getElementById("stick-point").style.top = top + "px";
            document.getElementById("stick-point").style.left = left + "px";
            this._setJoystickData(this._stickPositionY, this._stickPositionX);
            //console.log(stickPositionX + ' / ' + stickPositionY);
        },
        _sendStickPosition: function(throttle, steering) {
            if ((throttle > -5) && (throttle < 5)) {
                throttle = 0;
            }
            if (document.getElementById("enable-limit").checked) {
                throttle = throttle * document.getElementById("range").value / 100.0
                steering = steering * document.getElementById("range").value / 100.0
            }
            if (document.getElementById("throttle-reverse").checked) {
                throttle *= -1;
            }
            if (document.getElementById("steering-reverse").checked) {
                steering *= -1;
            }
            if (this._connected) {
                this._ws.send(JSON.stringify({command: "stick_position", data: {'throttle': Math.round(throttle), 'steering': Math.round(steering)}});
                //console.log(JSON.stringify({command: "stick_position", data: {'throttle': Math.round(throttle), 'steering': Math.round(steering)}});
            } else {
                // console.log(JSON.stringify({command: "rc_channels", data: {'3': throttle_limited, '1': steering_limited}}))
            }
        },
        _intervalSender:function() {
            if (this._mouseDown || this._gamepadActive) {
                //throttle = $("#joystick-throttle").text();
                //steering = $("#joystick-steering").text();
                var throttle = this._joystickData["throttle"];
                var steering = this._joystickData["steering"];
                this._sendStickPosition(throttle, steering);
            }
        },
        _connect: function(connectParameter) {
            this._ws = new WebSocket(connectParameter);

            // WebSocketのコールバック設定
            this._ws.onopen = this._onConnect.bind(this); // 接続できたとき
            this._ws.onerror = this._onError.bind(this); // 接続エラーのときのコールバック
            this._ws.onmessage = this._onMessage.bind(this); // メッセージを受け取ったときのコールバック
            this._ws.onclose = this._onClose.bind(this); // 接続を閉じたとき
        },
        _onConnect: function(event) {
            this._connected = true;
            this._sender = setInterval(this._intervalSender.bind(this), 250);
        },
        _onError: function(event) {
            this._connectButton.innerText = "CONNECT"
            console.log("WebSocket接続エラー")
        },
        _onMessage: function(event) {
            // WebSocketでメッセージを受け取った時の処理をまとめて
            if (event && event.data) {
                var jsonMessage = null;
                try {
                    jsonMessage = JSON.parse(event.data);
                } catch(e) {
                    alert('受け取ったメッセージの形式が不正です [message]:' + messageData['message']);
                }
                if (jsonMessage != null) {
                    this._parseMessage(jsonMessage);
                }
            }
        },
        _onClose: function(event) {
            this._connected = false;
            clearInterval(this._sender);
        },
        _parseMessage: function(jsonMessage) {
            console.log(jsonMessage);
            /*
            var messageName = jsonMessage['message_name'];
            var messageData = jsonMessage['message_data'];
            switch(messageName) {
                case "GLOBAL_POSITION_INT":
                    messageData["lat"] *= 1.0e-7;
                    messageData["lon"] *= 1.0e-7;
                    messageData["alt"] *= 1.0e-7;
                    this._setGpsData(messageData);
                    break;
                case "VFR_HUD":
                    this._setHudData(messageData);
                    break;
                case "SYS_STATUS":
                    messageData["voltage_battery"] *= 1.0e-3;
                    messageData["current_battery"] *= 1.0e-2;
                    this._setSysstatusData(messageData);
                    break;
            }
            */
        },
        _gamepadUpdate: function() {
            var pads = navigator.getGamepads ? navigator.getGamepads() :
                (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
            if (pads != null) {
                if (pads.length != this._gamepadDetectNumber) {
                    console.log("ゲームパッド認識");
                    console.log(pads);
                    while (document.getElementById("gamepad").firstChild) document.getElementById("gamepad").removeChild(document.getElementById("gamepad").firstChild);
                    for (var i = 0; i < pads.length; i++) {
                        if (pads[i] != null) {
                            console.log(i + ": " + pads[i].id);
                            var option = document.createElement("option");
                            option.value = i;
                            var text = document.createTextNode(pads[i].id);
                            option.appendChild(text);
                            document.getElementById("gamepad").appendChild(option);
                        }
                    }
                    this._gamepadInUse = 0;
                    this._gamepadDetectNumber = pads.length;
                }
                if (this._gamepadInUse != 999) {
                    var pad = pads[this._gamepadInUse];
                    this._padConnected = true;
                    var axes = pad.axes;
                    var padX = Math.round(axes[2] * 100);
                    var padY = Math.round(axes[1] * 100);
                    if ((padX != 0) || (padY != 0)) {
                        this._gamepadActive = true;
                        if (document.getElementById("enable-gamepad").checked) {
                            this._setStickPosition(padX, padY);
                        }
                    } else {
                        if (this._gamepadActive) {
                            this._resetStickPosition();
                            this._sendStickPosition(0, 0);
                            this._gamepadActive = false;
                        }
                    }
                }
            } else if (this._padConnected) {
                this._padConnected = false;
                this._setStickPosition(0,0);
            }
            window.requestAnimationFrame(this._gamepadUpdate.bind(this));
        },
        _setStickPosition: function(stickPositionX, stickPositionY) {
            var top = stickPositionY + 100;
            var left = stickPositionX + 100;
            document.getElementById("stick-point").style.top = top + "px";
            document.getElementById("stick-point").style.left = left + "px";
            this._setJoystickData(stickPositionY, stickPositionX);
            //console.log(stickPositionX + ' / ' + stickPositionY);
        },        
        _resetStickPosition: function() {
            var stickPositionX = 0;
            var stickPositionY = 0;
            var top = stickPositionY + 100;
            var left = stickPositionX + 100;
            document.getElementById("stick-point").style.top = top + "px";
            document.getElementById("stick-point").style.left = left + "px";
            this._setJoystickData(-stickPositionY, stickPositionX);
            //console.log(stickPositionX + ' / ' + stickPositionY);
        },
    };

    /*
    処理部
    */
    window.onload = function() {
        console.log('処理開始');

        // 遠隔コントローラのインスタンス生成
        var remoteController = new RemoteController();
    };
})((this || 0).self || global);
