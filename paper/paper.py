from IPython.html.widgets import DOMWidget, Widget, Color
from IPython.utils.traitlets import Float, List, Unicode, Int, Tuple, HasTraits, Bool
from zmq.eventloop import IOLoop

class CustomModel(Widget):
    _model_module = Unicode('nbextensions/paper/paper_widget', sync=True)

class Point(CustomModel):
    _model_name = Unicode('PointModel')
    x = Float(sync=True)
    y = Float(sync=True)

class Path(CustomModel):
    _model_name = Unicode('PathModel')
    stroke_color = Color('black', sync=True)
    stroke_width = Int(1, sync=True)
    points = Tuple(sync=True)
    closed = Bool(False, sync=True)
    
    def __init__(self, canvas, *args, **kwargs):
        super(Path, self).__init__(*args, **kwargs)
        canvas.paths = list(canvas.paths) + [self]

class Canvas(DOMWidget):
    _view_module = Unicode('nbextensions/paper/paper_widget', sync=True)
    _view_name = Unicode('PaperCanvas', sync=True)
    paths = Tuple(tuple(), sync=True)

    def draw(self):
        self.send({'type': 'draw'})

    def start_edit(self, index):
        self.send({'type': 'start_edit', 'index': index})

    def stop_edit(self, index):
        self.send({'type': 'stop_edit', 'index': index})


    def __init__(self, *args, **kwargs):
        super(Canvas, self).__init__(*args, **kwargs)
        self.on_msg(self._handle_msg)
