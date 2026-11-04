# Guía de NeoDeck

NeoDeck es un cockpit web: reúne una interfaz para conversar con agentes y herramientas para organizar el trabajo alrededor de esas conversaciones. Se sirve como aplicación web y se usa desde un navegador. No hace falta instalar otro cliente de escritorio para abrirlo, pero sí que alguien prepare y opere el servicio al que se conecta el navegador.

## Hoy y hacia dónde vamos

El código actual incluye selección y creación de sesiones, apertura de conversaciones guardadas y superficies como tablero, bandeja y rutinas. Su interfaz avisa si no hay un backend NeoPi disponible. Para la instalación y sus requisitos reales, consultá [instalación](install.md), [configuración](configuration.md) y [despliegue](deployment.md); no supongas que un checkout por sí solo configura un servicio para el equipo.

La intención es servir Deck en Utopia Planitia como cockpit del equipo. Eso todavía requiere despliegue y configuración de cuentas, acceso y claves por la responsable. En el futuro, Deck se conectaría a NeoCore para hacer visible y controlar trabajo compartido; NeoCore todavía no está implementado. No des por hecho que el servicio de oficina, el acceso compartido o esa conexión ya funcionan.

El diseño distingue tres servicios: NeoCore (futuro daemon de agentes), NeoProxy (gateway de inferencia) y NeoDeck (cockpit web). Los dos clientes instalables son NeoPi (motor más terminal) y NeoCode (interfaz gráfica). NeoPi puede ejecutarse localmente sin un daemon separado. A futuro, las interfaces podrían conectarse a agentes alojados localmente o en un daemon local o remoto; eso no es requisito de uso actual. El [panorama general](https://github.com/CooperbitQuarxs/neopi/blob/neopi/docs/panorama-general.md) explica el conjunto.

## Una primera tarea

1. Cuando el servicio esté habilitado, pedí a la responsable la dirección y el acceso autorizado. No pegues claves en conversaciones ni publiques datos sensibles.
2. Elegí el espacio de trabajo autorizado y creá una sesión. Planteá un resultado concreto, el contexto permitido y qué evidencia necesitás para revisarlo.
3. Revisá las respuestas y las acciones propuestas antes de aplicarlas. Pedí correcciones o más evidencia; el criterio y el conocimiento del dominio siguen siendo tuyos.
4. Usá el tablero o la bandeja para ordenar el trabajo cuando corresponda. Para retomar una conversación, buscá la sesión guardada; no presupongas que eso implica un daemon compartido o que otra persona pueda acceder a ella.

NeoProxy puede centralizar el acceso a proveedores. En la configuración de oficina prevista, la responsable administraría claves individuales y roles ofrecidos como modelos virtuales, con correspondencias de modelo y esfuerzo modificables centralmente. También se podrá elegir un modelo explícito donde esté disponible y autorizado. Esa configuración todavía debe prepararse; no compartas credenciales personales y respetá las condiciones del proveedor.

## Para quien prepara el servicio

Antes de habilitar acceso de equipo, revisá las instrucciones de [despliegue y endurecimiento](deployment.md), definí autenticación y permisos, transporte seguro, protección de datos y manejo de secretos. El acceso remoto previsto usa HTTPS o WebSocket seguro; el mecanismo de autenticación entre servicios todavía no está aprobado. Una clave de inferencia no debe tratarse como autorización general para controlar el trabajo de otros.

Referencias: [arquitectura](architecture.md), [comandos](slash-commands.md), [rutinas](routines-v1-tutorial.md), [cambios](../CHANGELOG.md) y [desarrollo del fork](https://github.com/PsychedelicShayna/neodeck). El upstream activo es [Shreyans13/omp-deck](https://github.com/Shreyans13/omp-deck); el origen histórico es [bjb2/omp-deck](https://github.com/bjb2/omp-deck), de Bryan Bartley. Se conserva la [licencia MIT](../LICENSE).
