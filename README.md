# NeoDeck: cockpit web para el equipo

NeoDeck ofrece una interfaz web para trabajar con agentes NeoPi y organizar el trabajo alrededor de sus sesiones. Se accede desde un navegador a un servicio; no es otra aplicación de escritorio para instalar en cada puesto. El repositorio ya contiene código: dejó de ser un marcador de posición. El despliegue compartido de oficina todavía debe prepararse.

En la arquitectura prevista hay tres servicios: **NeoCore**, daemon de agentes aún no implementado; **NeoProxy**, gateway de inferencia; y **NeoDeck**, cockpit web. Los dos clientes instalables son **NeoPi**, motor de agentes con interfaz de terminal, y **NeoCode**, interfaz gráfica. NeoPi puede ejecutarse localmente sin un daemon separado. Conectar interfaces a agentes alojados localmente o en un daemon local o remoto es una dirección futura, no una dependencia obligatoria actual. No se supone que los tres servicios ya estén desplegados o conectados.

La intención es servir Deck en Utopia Planitia para el equipo y, más adelante, conectarlo con NeoCore para trabajo compartido. Las cuentas, claves de API y el despliegue de oficina aún requieren configuración por la responsable. NeoProxy apunta a ofrecer roles como modelos virtuales administrados centralmente y permitir elegir modelos explícitos donde estén disponibles; esa configuración de oficina está pendiente.

- [Guía de NeoDeck para el equipo](docs/guia-neodeck-es-UY.md)
- [Panorama general del ecosistema](https://github.com/CooperbitQuarxs/neopi/blob/main/docs/panorama-general.md)
- [Instalación](docs/install.md) · [Configuración](docs/configuration.md) · [Despliegue y seguridad](docs/deployment.md) · [Arquitectura](docs/architecture.md)
- [NeoPi](https://github.com/CooperbitQuarxs/neopi) · [NeoCode](https://github.com/CooperbitQuarxs/neocode) · [NeoProxy](https://github.com/CooperbitQuarxs/NeoProxy)

## Origen y licencia

Este repositorio de Cooperbit es el espejo para el equipo. El desarrollo del fork está en [PsychedelicShayna/neodeck](https://github.com/PsychedelicShayna/neodeck), con sus [pull requests](https://github.com/PsychedelicShayna/neodeck/pulls?q=is%3Apr) e [issues](https://github.com/PsychedelicShayna/neodeck/issues?q=is%3Aissue). NeoDeck deriva de [bjb2/omp-deck](https://github.com/bjb2/omp-deck), de Bryan Bartley. El código está bajo licencia [MIT](LICENSE); se conservan los avisos de autoría heredados y de PsychedelicShayna.
