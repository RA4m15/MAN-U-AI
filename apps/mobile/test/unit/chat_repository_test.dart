import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:manuai_mobile/features/chat/repositories/chat_repository.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late ChatRepository repository;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:4000/api/v1'));
    dioAdapter = DioAdapter(dio: dio);
    repository = ChatRepository(dio: dio);
  });

  group('ChatRepository.getConversations', () {
    test('fetches and returns conversation list on 200 OK', () async {
      final mockData = {
        'success': true,
        'data': [
          {
            'id': 'conv-101',
            'title': 'Bearing Overhaul Protocol',
            'equipmentId': 'eq-1',
            'equipmentName': 'Slurry Pump (SP-400X)',
            'lastMessageAt': '2026-10-24T00:00:00.000Z',
            'createdAt': '2026-10-23T23:00:00.000Z',
          },
          {
            'id': 'conv-102',
            'title': 'Motor Winding Insulation Test',
            'lastMessageAt': '2026-10-23T20:00:00.000Z',
            'createdAt': '2026-10-23T19:00:00.000Z',
          },
        ],
      };

      dioAdapter.onGet(
        '/conversations',
        (server) => server.reply(200, mockData),
      );

      final conversations = await repository.getConversations();

      expect(conversations.length, equals(2));
      expect(conversations[0].id, equals('conv-101'));
      expect(conversations[0].title, equals('Bearing Overhaul Protocol'));
      expect(conversations[0].equipmentName, contains('Slurry Pump'));
      expect(conversations[1].equipmentName, isNull);
    });

    test('throws DioException when conversation query returns 500 server error', () async {
      dioAdapter.onGet(
        '/conversations',
        (server) => server.reply(500, {
          'success': false,
          'error': {'code': 'SERVER_ERROR', 'message': 'Database query failed'},
        }),
      );

      expect(
        () => repository.getConversations(),
        throwsA(isA<DioException>()),
      );
    });
  });

  group('ChatRepository.createConversation', () {
    test('creates and returns new conversation on 201 Created', () async {
      final mockResponse = {
        'success': true,
        'data': {
          'id': 'conv-201',
          'title': 'Mechanical Seal Leak Troubleshooting',
          'equipmentId': 'eq-50',
          'equipmentName': 'Centrifugal Pump (CP-10)',
          'createdAt': '2026-10-24T01:10:00.000Z',
        },
      };

      dioAdapter.onPost(
        '/conversations',
        (server) => server.reply(201, mockResponse),
        data: {
          'title': 'Mechanical Seal Leak Troubleshooting',
          'equipmentId': 'eq-50',
        },
      );

      final result = await repository.createConversation(
        title: 'Mechanical Seal Leak Troubleshooting',
        equipmentId: 'eq-50',
      );

      expect(result.id, equals('conv-201'));
      expect(result.title, equals('Mechanical Seal Leak Troubleshooting'));
      expect(result.equipmentId, equals('eq-50'));
    });

    test('throws DioException on 400 invalid equipment ID', () async {
      dioAdapter.onPost(
        '/conversations',
        (server) => server.reply(400, {
          'success': false,
          'error': {'code': 'INVALID_EQUIPMENT_ID', 'message': 'Invalid equipment ID format'},
        }),
      );

      expect(
        () => repository.createConversation(equipmentId: 'bad-id'),
        throwsA(isA<DioException>()),
      );
    });
  });

  group('ChatRepository.getMessages', () {
    test('fetches message list with technical citations for conversation ID', () async {
      final mockData = {
        'success': true,
        'data': [
          {
            'id': 'msg-1',
            'conversationId': 'conv-301',
            'role': 'user',
            'content': 'Check torque specifications',
            'createdAt': '2026-10-24T01:00:00.000Z',
          },
          {
            'id': 'msg-2',
            'conversationId': 'conv-301',
            'role': 'assistant',
            'content': 'Torque studs to 52 N·m.',
            'citations': [
              {
                'documentId': 'doc-1',
                'documentTitle': 'Pump Overhaul SOP',
                'revision': 'Rev 5.2',
                'page': 3,
                'excerpt': 'M12 gland retaining studs must be torqued to 52 N·m.',
              }
            ],
            'createdAt': '2026-10-24T01:00:04.000Z',
          },
        ],
      };

      dioAdapter.onGet(
        '/conversations/conv-301/messages',
        (server) => server.reply(200, mockData),
      );

      final messages = await repository.getMessages('conv-301');

      expect(messages.length, equals(2));
      expect(messages[0].isUser, isTrue);
      expect(messages[1].isAssistant, isTrue);
      expect(messages[1].citations.length, equals(1));
      expect(messages[1].citations.first.excerpt, contains('52 N·m'));
    });
  });

  group('ChatRepository.sendMessage', () {
    test('sends question and receives grounded answer with citations and warningLevel', () async {
      final mockResponse = {
        'success': true,
        'data': {
          'answer': 'Warning: Ensure motor is fully isolated under LOTO before disassembly.',
          'citations': [
            {
              'documentId': 'doc-safe-1',
              'documentTitle': 'Facility Electrical Safety Standard',
              'revision': 'Rev 3.0',
              'page': 12,
              'section': '2.1 Lockout Tagout',
              'excerpt': 'Zero energy state verification required before opening junction box.',
            }
          ],
          'warningLevel': 'critical',
          'confidenceScore': 0.96,
          'provider': 'gemini-1.5-pro',
        },
      };

      dioAdapter.onPost(
        '/chat',
        (server) => server.reply(200, mockResponse),
        data: {
          'message': 'How do I open the motor junction box?',
          'conversationId': 'conv-401',
        },
      );

      final result = await repository.sendMessage(
        message: 'How do I open the motor junction box?',
        conversationId: 'conv-401',
      );

      expect(result.answer, contains('LOTO'));
      expect(result.warningLevel, equals('critical'));
      expect(result.confidenceScore, equals(0.96));
      expect(result.citations.length, equals(1));
      expect(result.citations.first.documentTitle, equals('Facility Electrical Safety Standard'));
    });

    test('throws DioException when rate limit 429 occurs', () async {
      dioAdapter.onPost(
        '/chat',
        (server) => server.reply(429, {
          'success': false,
          'error': {'code': 'RATE_LIMIT_EXCEEDED', 'message': 'Too many requests'},
        }),
      );

      expect(
        () => repository.sendMessage(
          message: 'Repeated fast query',
          conversationId: 'conv-401',
        ),
        throwsA(isA<DioException>()),
      );
    });
  });
}
