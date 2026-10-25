import 'package:flutter_test/flutter_test.dart';
import 'package:manuai_mobile/features/chat/models/chat_message_model.dart';
import 'package:manuai_mobile/features/chat/models/chat_response_model.dart';
import 'package:manuai_mobile/features/chat/models/citation_model.dart';
import 'package:manuai_mobile/features/chat/models/conversation_model.dart';
import 'package:manuai_mobile/features/equipment/models/equipment_model.dart';

void main() {
  group('CitationModel JSON Serialization', () {
    test('parses full citation JSON payload matching backend CitationDTO', () {
      final json = {
        'id': 'cite-001',
        'documentId': 'doc-1234',
        'documentTitle': 'Model SP-400X Slurry Pump Technical SOP',
        'revision': 'Rev 5.2',
        'page': 3,
        'section': '4.2 Mechanical Seal Assembly',
        'excerpt': 'Gland retaining studs must be torqued to 52 N·m in cross-diagonal sequence.',
        'figures': [
          {'storagePath': 'figures/fig-1.png', 'figureId': 'fig-1'},
          'figures/fig-2.png',
        ],
      };

      final citation = CitationModel.fromJson(json);

      expect(citation.id, equals('cite-001'));
      expect(citation.documentId, equals('doc-1234'));
      expect(citation.documentTitle, equals('Model SP-400X Slurry Pump Technical SOP'));
      expect(citation.revision, equals('Rev 5.2'));
      expect(citation.page, equals(3));
      expect(citation.section, equals('4.2 Mechanical Seal Assembly'));
      expect(citation.excerpt, contains('52 N·m'));
      expect(citation.figures.length, equals(2));
      expect(citation.figures[0], equals('figures/fig-1.png'));
      expect(citation.figures[1], equals('figures/fig-2.png'));
    });

    test('handles fallback defaults on sparse citation payload', () {
      final json = {
        'documentId': 'doc-999',
        'excerpt': 'Brief procedural note.',
      };

      final citation = CitationModel.fromJson(json);

      expect(citation.documentId, equals('doc-999'));
      expect(citation.documentTitle, equals('Technical Document'));
      expect(citation.revision, equals('Rev 1.0'));
      expect(citation.page, equals(1));
      expect(citation.section, isNull);
      expect(citation.figures, isEmpty);
    });
  });

  group('ChatMessageModel JSON Serialization', () {
    test('parses user message correctly', () {
      final json = {
        'id': 'msg-101',
        'conversationId': 'conv-001',
        'role': 'user',
        'content': 'What is the torque spec for the gland studs?',
        'createdAt': '2026-10-24T00:30:00.000Z',
      };

      final message = ChatMessageModel.fromJson(json);

      expect(message.id, equals('msg-101'));
      expect(message.conversationId, equals('conv-001'));
      expect(message.role, equals('user'));
      expect(message.isUser, isTrue);
      expect(message.isAssistant, isFalse);
      expect(message.content, contains('torque spec'));
      expect(message.citations, isEmpty);
      expect(message.createdAt, isNotNull);
    });

    test('parses assistant message with industrial safety metadata and citations', () {
      final json = {
        'id': 'msg-102',
        'conversationId': 'conv-001',
        'role': 'assistant',
        'content': 'The four M12 gland retaining studs must be torqued to exactly 52 N·m.',
        'warningLevel': 'critical',
        'confidenceScore': 0.94,
        'provider': 'gemini-1.5-pro',
        'citations': [
          {
            'documentId': 'doc-1234',
            'documentTitle': 'Model SP-400X Slurry Pump Technical SOP',
            'revision': 'Rev 5.2',
            'page': 3,
            'excerpt': 'Gland retaining studs must be torqued to 52 N·m.',
          }
        ],
        'createdAt': '2026-10-24T00:30:05.000Z',
      };

      final message = ChatMessageModel.fromJson(json);

      expect(message.isAssistant, isTrue);
      expect(message.warningLevel, equals('critical'));
      expect(message.confidenceScore, equals(0.94));
      expect(message.provider, equals('gemini-1.5-pro'));
      expect(message.citations.length, equals(1));
      expect(message.citations.first.documentTitle, contains('SP-400X'));
    });
  });

  group('ConversationModel JSON Serialization', () {
    test('parses conversation matching ConversationDTO', () {
      final json = {
        'id': 'conv-777',
        'title': 'Pump Vibration Diagnostics',
        'equipmentId': 'eq-400',
        'equipmentName': 'Slurry Pump SP-400X (Flowserve)',
        'lastMessageAt': '2026-10-24T01:00:00.000Z',
        'createdAt': '2026-10-24T00:00:00.000Z',
      };

      final conv = ConversationModel.fromJson(json);

      expect(conv.id, equals('conv-777'));
      expect(conv.title, equals('Pump Vibration Diagnostics'));
      expect(conv.equipmentId, equals('eq-400'));
      expect(conv.equipmentName, contains('Slurry Pump'));
      expect(conv.lastMessageAt, isNotNull);
      expect(conv.createdAt, isNotNull);
    });

    test('copyWith creates modified clone', () {
      const conv = ConversationModel(
        id: 'c1',
        title: 'Original Title',
      );

      final updated = conv.copyWith(title: 'Updated Title', equipmentId: 'eq-1');

      expect(updated.id, equals('c1'));
      expect(updated.title, equals('Updated Title'));
      expect(updated.equipmentId, equals('eq-1'));
    });
  });

  group('ChatResponseModel JSON Serialization', () {
    test('parses POST /chat response payload', () {
      final json = {
        'answer': 'Verify isolation before disassembly.',
        'warningLevel': 'warning',
        'confidenceScore': 0.88,
        'provider': 'gemini',
        'citations': [
          {
            'documentId': 'doc-1',
            'documentTitle': 'Safety Manual',
            'revision': 'Rev 2.0',
            'page': 1,
            'excerpt': 'Perform mechanical lockout.',
          }
        ],
      };

      final resp = ChatResponseModel.fromJson(json);

      expect(resp.answer, equals('Verify isolation before disassembly.'));
      expect(resp.warningLevel, equals('warning'));
      expect(resp.confidenceScore, equals(0.88));
      expect(resp.provider, equals('gemini'));
      expect(resp.citations.length, equals(1));
    });
  });

  group('EquipmentModel JSON Serialization', () {
    test('parses equipment record and formats displayName', () {
      final json = {
        'id': 'eq-501',
        'name': 'Primary Slurry Pump',
        'type': 'Centrifugal Pump',
        'model': 'SP-400X',
        'manufacturer': 'Flowserve',
        'location': 'Flotation Plant Cell 4',
        'serialNumber': 'SN-998822',
      };

      final eq = EquipmentModel.fromJson(json);

      expect(eq.id, equals('eq-501'));
      expect(eq.name, equals('Primary Slurry Pump'));
      expect(eq.model, equals('SP-400X'));
      expect(eq.displayName, equals('Primary Slurry Pump (SP-400X)'));
    });
  });
}
