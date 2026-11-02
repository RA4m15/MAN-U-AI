import { Router, Request, Response } from "express";
import { requireAuth } from "../middlewares/auth";
import { ticketService } from "../services/ticket.service";
import {
  CreateDocRequestTicketSchema,
  UpdateDocRequestTicketSchema,
  ApiResponse,
  DocRequestTicketDTO,
} from "@man-u-ai/shared";

export const ticketRouter = Router();

// Viewer and above can create documentation request tickets
ticketRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = CreateDocRequestTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid ticket payload.",
        },
      });
    }

    const userId = String((req as any).user?.id || (req as any).user?._id);
    const created = await ticketService.createTicket(parseResult.data, userId);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "TICKET_CREATE_ERROR", message: err.message },
    });
  }
});

// List documentation request tickets
ticketRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.id || (req as any).user?._id;
    const { status } = req.query;

    const tickets = await ticketService.listTickets(
      userRole,
      userId,
      typeof status === "string" ? status : undefined
    );

    const response: ApiResponse<DocRequestTicketDTO[]> = {
      success: true,
      data: tickets,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "TICKETS_FETCH_ERROR", message: err.message },
    });
  }
});

// Update ticket status or resolution notes (admin, manager, engineer)
ticketRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole === "operator") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Operators cannot modify documentation request tickets." },
      });
    }

    const id = String(req.params.id);
    const parseResult = UpdateDocRequestTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid ticket update payload.",
        },
      });
    }

    const updated = await ticketService.updateTicket(id, parseResult.data);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: "TICKET_NOT_FOUND", message: `Ticket with ID ${id} was not found.` },
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "TICKET_UPDATE_ERROR", message: err.message },
    });
  }
});
