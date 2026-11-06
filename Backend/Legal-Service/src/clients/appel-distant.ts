import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';
import { Observable, firstValueFrom } from 'rxjs';

/**
 * Exécute un appel HTTP vers un autre microservice et renvoie le corps de la réponse.
 * - Le service a répondu avec une erreur (404, 409, 400...) : on la relaie telle quelle.
 * - Le service est injoignable (éteint, timeout) : 503 Service Unavailable.
 */
export async function appelDistant<T>(
  service: string,
  requete: Observable<AxiosResponse<T>>,
): Promise<T> {
  try {
    const response = await firstValueFrom(requete);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as { message?: string | string[] } | undefined;
      throw new HttpException(
        data?.message ?? error.message,
        error.response.status,
      );
    }
    throw new ServiceUnavailableException(
      `${service} est indisponible, veuillez réessayer plus tard`,
    );
  }
}
