import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../documents/views/widgets/authenticated_figure_viewer.dart';
import '../../models/citation_model.dart';

class CitationCard extends StatefulWidget {
  final CitationModel citation;
  final int index;

  const CitationCard({
    super.key,
    required this.citation,
    required this.index,
  });

  @override
  State<CitationCard> createState() => _CitationCardState();
}

class _CitationCardState extends State<CitationCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.citation;
    return Container(
      margin: const EdgeInsets.only(top: 8.0),
      decoration: BoxDecoration(
        color: AppColors.surface1,
        borderRadius: BorderRadius.circular(8.0),
        border: Border.all(color: AppColors.hairline),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(8.0),
        onTap: () {
          setState(() {
            _isExpanded = !_isExpanded;
          });
        },
        child: Padding(
          padding: const EdgeInsets.all(10.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                    decoration: BoxDecoration(
                      color: AppColors.surface3,
                      borderRadius: BorderRadius.circular(4.0),
                      border: Border.all(color: AppColors.hairlineStrong),
                    ),
                    child: Text(
                      '[${widget.index + 1}]',
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primaryHover,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8.0),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c.documentTitle,
                          style: const TextStyle(
                            fontSize: 12.0,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                          maxLines: _isExpanded ? null : 1,
                          overflow: _isExpanded ? null : TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2.0),
                        Wrap(
                          spacing: 6.0,
                          runSpacing: 2.0,
                          children: [
                            Text(
                              c.revision,
                              style: const TextStyle(
                                fontSize: 10.0,
                                color: AppColors.inkSubtle,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const Text('•', style: TextStyle(fontSize: 10.0, color: AppColors.inkSubtle)),
                            Text(
                              'Page ${c.page}',
                              style: const TextStyle(
                                fontSize: 10.0,
                                color: AppColors.inkSubtle,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (c.section != null && c.section!.isNotEmpty) ...[
                              const Text('•', style: TextStyle(fontSize: 10.0, color: AppColors.inkSubtle)),
                              Text(
                                c.section!,
                                style: const TextStyle(
                                  fontSize: 10.0,
                                  color: AppColors.inkSubtle,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _isExpanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                    color: AppColors.inkSubtle,
                    size: 18.0,
                  ),
                ],
              ),
              if (_isExpanded && c.excerpt.isNotEmpty) ...[
                const SizedBox(height: 8.0),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(8.0),
                  decoration: BoxDecoration(
                    color: AppColors.canvas,
                    borderRadius: BorderRadius.circular(6.0),
                    border: Border.all(color: AppColors.hairline),
                  ),
                  child: Text(
                    c.excerpt,
                    style: const TextStyle(
                      fontSize: 11.0,
                      height: 1.45,
                      color: AppColors.inkMuted,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
              if (c.figures.isNotEmpty) ...[
                const SizedBox(height: 6.0),
                Row(
                  children: [
                    const Icon(Icons.image_outlined, size: 12.0, color: AppColors.primaryHover),
                    const SizedBox(width: 4.0),
                    Text(
                      '${c.figures.length} figure(s) referenced',
                      style: const TextStyle(
                        fontSize: 10.0,
                        color: AppColors.primaryHover,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
              if (_isExpanded && c.figures.isNotEmpty) ...[
                const SizedBox(height: 8.0),
                ...c.figures.map(
                  (figId) => AuthenticatedFigureViewer(
                    key: Key('auth_figure_${widget.index}_$figId'),
                    documentId: c.documentId,
                    figureId: figId,
                    documentTitle: c.documentTitle,
                    page: c.page,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
