import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/features/tasks/models/task_model.dart';

void main() {
  group('TaskModel JSON Serialization & Status Handling', () {
    test('parses full backend TaskDTO JSON payload', () {
      final now = DateTime.now();
      final json = {
        'id': 'task-101',
        'title': 'Inspect Centrifugal Compressor C-04',
        'description': 'Check seal tolerances and measure vibration harmonics.',
        'priority': 'high',
        'status': 'pending',
        'equipmentId': 'eq-c04',
        'equipmentName': 'Compressor C-04',
        'assignedTo': 'all',
        'assignedToName': 'All Field Engineers',
        'shift': 'Morning',
        'createdByName': 'Operations Manager',
        'createdAt': now.toIso8601String(),
      };

      final task = TaskModel.fromJson(json);

      expect(task.id, equals('task-101'));
      expect(task.title, equals('Inspect Centrifugal Compressor C-04'));
      expect(task.priority, equals('high'));
      expect(task.status, equals('pending'));
      expect(task.isPending, isTrue);
      expect(task.isInProgress, isFalse);
      expect(task.isCompleted, isFalse);
      expect(task.equipmentName, equals('Compressor C-04'));
      expect(task.shift, equals('Morning'));
    });

    test('supports status transition and completion notes via copyWith', () {
      final task = TaskModel(
        id: 'task-102',
        title: 'Calibrate Pressure Transducer PT-22',
        description: 'Zero calibrate sensor with dry nitrogen reference.',
        priority: 'critical',
        status: 'pending',
        createdAt: DateTime.now(),
      );

      expect(task.isPending, isTrue);

      // Start task
      final inProgress = task.copyWith(status: 'in_progress');
      expect(inProgress.isInProgress, isTrue);
      expect(inProgress.isPending, isFalse);

      // Complete task
      final completedNow = DateTime.now();
      final completed = inProgress.copyWith(
        status: 'completed',
        completionNotes: 'Calibrated to 0.002 bar tolerance with certified gauge.',
        completedAt: completedNow,
      );

      expect(completed.isCompleted, isTrue);
      expect(completed.completionNotes, contains('0.002 bar'));
      expect(completed.completedAt, equals(completedNow));
    });

    test('serializes back to JSON matching backend API expectations', () {
      final task = TaskModel(
        id: 'task-103',
        title: 'Check Conveyor Tension',
        description: 'Measure slack on Line 2.',
        priority: 'low',
        status: 'completed',
        equipmentId: 'eq-cv-02',
        equipmentName: 'Conveyor 2',
        completionNotes: 'Tension adjusted.',
        createdAt: DateTime.parse('2026-10-31T10:00:00Z'),
        completedAt: DateTime.parse('2026-10-31T11:00:00Z'),
      );

      final json = task.toJson();

      expect(json['id'], equals('task-103'));
      expect(json['title'], equals('Check Conveyor Tension'));
      expect(json['status'], equals('completed'));
      expect(json['completionNotes'], equals('Tension adjusted.'));
      expect(json['equipmentName'], equals('Conveyor 2'));
    });
  });
}

