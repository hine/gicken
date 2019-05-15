#!/home/hine/.pyenv/versions/gicken/bin/python
"""ギッケン（を含む汎用）ロボットコントロールUI用

[実行環境]
Python 3.7.x
"""
__author__ = "Daisuke IMAI <hine.gdw@gmail.com>"
__status__ = "develop"
__version__ = "0.0.1"
__date__ = "2019/05/15"

import os
import sys
import time
import json

import tornado.ioloop
import tornado.websocket


class Controller(object):
    def __init__(self):
        self._stick_position = {"x":0, "y":0}
        self._pilot = None
    
    def set_stick_position(self, position_dict):
        if "x" in position_dict.keys():
            self._stick_position["x"] = position_dict["x"]
        if "y" in position_dict.keys():
            self._stick_position["y"] = position_dict["y"]

    def get_stick_position(self):
        return self._stick_position

    def reset_stick_position(self):
        self._stick_position = {"x":0, "y":0}

    def set_pilot(self, pilot):
        self._pilot = pilot

    def get_pilot(self):
        return self._pilot

    def clear_pilot(self):
        self._pilot = None

class Daemon(object):
    def __init__(self):
        """ギッケン（を含む）汎用なコントロール仲介サーバーの初期化
        各種インスタンスの生成と、Tornadoの起動、

        引数: なし
        戻値: なし
        """
        # Controllerのインスタンス生成
        controller = Controller()

        self.web_application = tornado.web.Application([
            (r'/', WebHandler),
            (r'/ws', WebSocketHandler, dict(controller=controller)),
        ],
            template_path=os.path.join(os.getcwd(),  'htdocs/templates'),
            static_path=os.path.join(os.getcwd(),  'htdocs/assets'),
        )

        # Tornado起動
        print('Starting Web/WebSocket Server...', end='')
        self.web_application.listen(8880)
        print('done')

        print('Open http://gicken.creatorsnight.com:8880/')
        print('')

        # Tornadoメインループ
        tornado.ioloop.IOLoop.instance().start()


#ここからTornadeでのWeb/WebSocketサーバーに関する定義
class WebHandler(tornado.web.RequestHandler):
    """通常のHTTPリクエストで/が求められた時のハンドラ
    """
    #@tornado.web.asynchronous
    async def get(self):
        self.render("index.html")


class WebSocketHandler(tornado.websocket.WebSocketHandler):
    """WebSocketで/wsにアクセスが来た時のハンドラ
    on_message -> receive data
    write_message -> send data
    """
    _clients = set()
    _robot_clients = set()

    def initialize(self, controller):
        self._auto_send_period = 100
        self._controller = controller

    def open(self):
        self._clients.add(self)
        # [Todo: 接続時に勝手にコントロール権を奪うか（現在はさせない）]
        # if self._controller.get_pilot == None:
        #    self._controller.set_pilot(self)
        self.callback = tornado.ioloop.PeriodicCallback(self._send_message, self._auto_send_period)
        self.callback.start()
        print('WebSocket opened')

    def check_origin(self, origin):
        #アクセス元チェックをしないように上書き
        return True

    def on_message(self, message):
        pass

    def _send_message(self):
        websocket_message = {}
        websocket_message["robot_clients"] = len(self._robot_clients)
        websocket_message["robot_clients"] = len(self._robot_clients)
        websocket_message["stick_position"] = self._controller.get_stick_position
        websocket_message["enable_controll"] = False
        if self._controller.get_pilot == self:
            websocket_message["enable_controll"] = True
        self.write_message(json.dumps(websocket_message))

    def on_close(self):
        if self._controller.get_pilot == self:
            self._controller.set_pilot(None)
        self._clients.remove(self)
        if self in self._robot_clients:
            self._robot_clients.remove(self)
        self.callback.stop()
        print('WebSocket closed')


def main():
    """メイン処理
    サービスとして起動するためのプロセス管理

    引数: なし
    戻値: なし
    """
    #daemonの処理
    pid = os.fork()

    if pid > 0:
        # 親プロセスの場合
        f = open('/var/run/gicken_server.pid','w')
        f.write(str(pid)+"\n")
        f.close()
        sys.exit()

    if pid == 0:
        # 子プロセスの場合

        daemon = Daemon()

        # メインループ
        while True:
            try:
                time.sleep(1)
            except KeyboardInterrupt:
                print("Stop.")
                break


# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
if __name__ == '__main__':
    # メイン処理の実行
    # main()
    daemon = Daemon()

    # メインループ
    while True:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            print("Stop.")
            break
