import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

enum _BlinkStep { lookAtCamera, blink, openEyes, capturing }

/// Kamera langsung dengan cek kedip: foto baru diambil setelah satu wajah
/// terlihat, berkedip, lalu membuka mata lagi. Ini mencegah absen dengan
/// menyodorkan foto cetak atau layar HP ke kamera.
class FaceCameraScreen extends StatefulWidget {
  final String title;
  final CameraLensDirection initialLens;

  const FaceCameraScreen({
    super.key,
    required this.title,
    this.initialLens = CameraLensDirection.front,
  });

  /// Membuka kamera dan mengembalikan foto JPEG sebagai base64,
  /// atau null kalau pengguna menutup kamera.
  static Future<String?> capture(
    BuildContext context, {
    required String title,
    CameraLensDirection initialLens = CameraLensDirection.front,
  }) async {
    final bytes = await Navigator.push<Uint8List>(
      context,
      MaterialPageRoute(builder: (_) => FaceCameraScreen(title: title, initialLens: initialLens)),
    );
    return bytes == null ? null : base64Encode(bytes);
  }

  @override
  State<FaceCameraScreen> createState() => _FaceCameraScreenState();
}

class _FaceCameraScreenState extends State<FaceCameraScreen> {
  static const _eyesOpen = 0.7;
  static const _eyesClosed = 0.25;
  static const _minFaceWidthRatio = 0.25;

  static final _orientations = {
    DeviceOrientation.portraitUp: 0,
    DeviceOrientation.landscapeLeft: 90,
    DeviceOrientation.portraitDown: 180,
    DeviceOrientation.landscapeRight: 270,
  };

  final _detector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: true,
      performanceMode: FaceDetectorMode.fast,
    ),
  );

  List<CameraDescription> _cameras = [];
  CameraController? _controller;
  bool _isProcessing = false;
  _BlinkStep _step = _BlinkStep.lookAtCamera;
  String _hint = 'Menyiapkan kamera...';
  String? _error;

  @override
  void initState() {
    super.initState();
    _start(widget.initialLens);
  }

  @override
  void dispose() {
    _controller?.dispose();
    _detector.close();
    super.dispose();
  }

  Future<void> _start(CameraLensDirection lens) async {
    try {
      if (_cameras.isEmpty) _cameras = await availableCameras();
      final camera = _cameras.firstWhere(
        (c) => c.lensDirection == lens,
        orElse: () => _cameras.first,
      );

      await _controller?.dispose();
      final controller = CameraController(
        camera,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid ? ImageFormatGroup.nv21 : ImageFormatGroup.bgra8888,
      );
      _controller = controller;
      await controller.initialize();
      await controller.startImageStream(_onFrame);
      if (mounted) {
        setState(() {
          _step = _BlinkStep.lookAtCamera;
          _hint = 'Arahkan wajah ke kamera';
        });
      }
    } on CameraException catch (e) {
      if (mounted) setState(() => _error = 'Kamera tidak bisa dibuka: ${e.description ?? e.code}');
    }
  }

  Future<void> _switchCamera() async {
    final current = _controller?.description.lensDirection;
    await _start(current == CameraLensDirection.front ? CameraLensDirection.back : CameraLensDirection.front);
  }

  Future<void> _onFrame(CameraImage image) async {
    if (_isProcessing || _step == _BlinkStep.capturing) return;
    final input = _toInputImage(image);
    if (input == null) return;

    _isProcessing = true;
    try {
      final faces = await _detector.processImage(input);
      _advance(faces, image.width < image.height ? image.width : image.height);
    } catch (_) {
      // Frame yang gagal diproses cukup dilewati
    } finally {
      _isProcessing = false;
    }
  }

  void _advance(List<Face> faces, int shortSide) {
    if (faces.length != 1) {
      _setStep(_BlinkStep.lookAtCamera, faces.isEmpty ? 'Arahkan wajah ke kamera' : 'Hanya boleh satu wajah di kamera');
      return;
    }
    final face = faces.first;
    if (face.boundingBox.width < shortSide * _minFaceWidthRatio) {
      _setStep(_BlinkStep.lookAtCamera, 'Dekatkan wajah ke kamera');
      return;
    }
    final left = face.leftEyeOpenProbability;
    final right = face.rightEyeOpenProbability;
    if (left == null || right == null) {
      _setStep(_BlinkStep.lookAtCamera, 'Hadapkan wajah lurus ke kamera');
      return;
    }

    final open = left > _eyesOpen && right > _eyesOpen;
    final closed = left < _eyesClosed && right < _eyesClosed;
    switch (_step) {
      case _BlinkStep.lookAtCamera:
        if (open) _setStep(_BlinkStep.blink, 'Kedipkan mata');
      case _BlinkStep.blink:
        if (closed) _setStep(_BlinkStep.openEyes, 'Buka mata dan tetap lihat kamera');
      case _BlinkStep.openEyes:
        if (open) _takePicture();
      case _BlinkStep.capturing:
        break;
    }
  }

  void _setStep(_BlinkStep step, String hint) {
    if (!mounted || (_step == step && _hint == hint)) return;
    setState(() {
      _step = step;
      _hint = hint;
    });
  }

  Future<void> _takePicture() async {
    final controller = _controller;
    if (controller == null) return;
    _setStep(_BlinkStep.capturing, 'Mengambil foto...');
    try {
      await controller.stopImageStream();
      final file = await controller.takePicture();
      final bytes = await file.readAsBytes();
      if (mounted) Navigator.pop(context, bytes);
    } on CameraException catch (e) {
      if (mounted) setState(() => _error = 'Gagal mengambil foto: ${e.description ?? e.code}');
    }
  }

  InputImage? _toInputImage(CameraImage image) {
    final controller = _controller;
    if (controller == null) return null;
    final camera = controller.description;

    InputImageRotation? rotation;
    if (Platform.isIOS) {
      rotation = InputImageRotationValue.fromRawValue(camera.sensorOrientation);
    } else {
      final deviceRotation = _orientations[controller.value.deviceOrientation];
      if (deviceRotation == null) return null;
      final compensation = camera.lensDirection == CameraLensDirection.front
          ? (camera.sensorOrientation + deviceRotation) % 360
          : (camera.sensorOrientation - deviceRotation + 360) % 360;
      rotation = InputImageRotationValue.fromRawValue(compensation);
    }
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null ||
        (Platform.isAndroid && format != InputImageFormat.nv21) ||
        (Platform.isIOS && format != InputImageFormat.bgra8888)) {
      return null;
    }
    if (image.planes.length != 1) return null;

    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          if (_cameras.length > 1)
            IconButton(
              tooltip: 'Ganti kamera',
              icon: const Icon(Icons.cameraswitch_rounded),
              onPressed: _step == _BlinkStep.capturing ? null : _switchCamera,
            ),
        ],
      ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
              ),
            )
          : Stack(
              fit: StackFit.expand,
              children: [
                if (controller != null && controller.value.isInitialized)
                  Center(child: CameraPreview(controller))
                else
                  const Center(child: CircularProgressIndicator(color: Colors.white)),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 32,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _hint,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
