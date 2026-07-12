# HazMat Respuesta Inicial v1.0 — Sprint 7

## Meteorología automática
- Consulta por coordenadas mediante Open-Meteo.
- No requiere clave de API.
- Temperatura.
- Humedad relativa.
- Viento a 10 m.
- Dirección desde donde sopla.
- Ráfagas.
- Nubosidad.
- Presión superficial.
- Hora y zona horaria del dato.
- Pronóstico horario próximo.

## Jerarquía de fuentes
1. Medición local en escena.
2. Ingreso manual verificado.
3. Servicio meteorológico remoto.

## Integración
- Aplicación de la dirección del viento al mapa.
- Registro de fuente, confianza y observaciones.
- Guardado local por incidente.
- Exportación JSON.
- Barra global de estado actualizada.

## Importante
Open-Meteo entrega condiciones actuales basadas en datos de modelos meteorológicos. La medición local conserva prioridad para decisiones operativas.

## Actualización
Reemplace todos los archivos del repositorio y haga commit.
La consulta automática requiere conexión a internet; el resto de la aplicación sigue funcionando offline.
