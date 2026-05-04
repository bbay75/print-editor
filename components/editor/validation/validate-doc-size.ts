export function validateDocSize(widthValue: string, heightValue: string) {
  const errors: { width?: string; height?: string } = {};

  if (!widthValue) {
    errors.width = "Өргөний хэмжээг оруулна уу";
  }

  if (!heightValue) {
    errors.height = "Өндрийн хэмжээг оруулна уу";
  }

  return errors;
}
