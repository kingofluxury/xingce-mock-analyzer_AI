export class AppError extends Error {
  constructor(message, { status = 500, details = [], expose = false } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, { status: 400, details, expose: true });
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "记录不存在") {
    super(message, { status: 404, expose: true });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, { status: 409, expose: true });
    this.name = "ConflictError";
  }
}
