import 'dart:convert';
import 'dart:io';

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image_picker/image_picker.dart';

class SelfieCancelled implements Exception {}

class SelfieService {
  static final ImagePicker _picker = ImagePicker();

  /// Membuka kamera depan, memastikan ada tepat satu wajah di foto (ML Kit),
  /// lalu mengembalikan foto sebagai base64 JPEG untuk dikirim ke server.
  static Future<String> captureFaceSelfie() async {
    final photo = await _picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxWidth: 720,
      imageQuality: 70,
    );
    if (photo == null) throw SelfieCancelled();

    final detector = FaceDetector(
      options: FaceDetectorOptions(performanceMode: FaceDetectorMode.accurate),
    );
    try {
      final faces = await detector.processImage(InputImage.fromFilePath(photo.path));
      if (faces.isEmpty) {
        throw Exception('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan cahaya cukup.');
      }
      if (faces.length > 1) {
        throw Exception('Terdeteksi lebih dari satu wajah. Ambil selfie sendiri.');
      }
    } finally {
      await detector.close();
    }

    final bytes = await File(photo.path).readAsBytes();
    return base64Encode(bytes);
  }
}
