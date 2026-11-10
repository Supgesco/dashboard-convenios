// Gerado por `npm run api:tipos` a partir do OpenAPI da API. Não edite à mão.

export interface paths {
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Login */
        post: operations["login_auth_login_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Logout */
        post: operations["logout_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Me */
        get: operations["me_auth_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/etl/siafe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Disparar Carga Siafe */
        post: operations["disparar_carga_siafe_etl_siafe_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/etl/siafe/execucoes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Historico Cargas Siafe
         * @description Execuções de carga SIAFE, da mais recente para a mais antiga.
         */
        get: operations["historico_cargas_siafe_etl_siafe_execucoes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/etl/siafe/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Status Carga Siafe */
        get: operations["status_carga_siafe_etl_siafe_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/convenio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Convenio
         * @description Detalhe de um convênio, identificado por número e município.
         */
        get: operations["convenio_painel_convenio_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/convenios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Convenios */
        get: operations["convenios_painel_convenios_get"];
        /**
         * Editar Convenio
         * @description Atualiza os campos editáveis de um convênio da tabela.
         */
        put: operations["editar_convenio_painel_convenios_put"];
        /**
         * Cadastrar Convenio
         * @description Cadastra um novo convênio (com normalização SIAFE SEOBRAS/SEIOP) nos recortes selecionados.
         */
        post: operations["cadastrar_convenio_painel_convenios_post"];
        /**
         * Excluir Convenio
         * @description Remove um convênio da base e atualiza os totais dos recortes.
         */
        delete: operations["excluir_convenio_painel_convenios_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/municipios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Municipios */
        get: operations["municipios_painel_municipios_get"];
        /**
         * Editar Municipio
         * @description Atualiza os valores de um município da tabela.
         */
        put: operations["editar_municipio_painel_municipios_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/prestacao-contas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Prestacao Contas
         * @description Consulta as parcelas e notas da aba Prestação de Contas da planilha.
         */
        get: operations["prestacao_contas_painel_prestacao_contas_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/prestacao-contas/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Editar Prestacao Contas
         * @description Atualiza uma parcela da aba Prestação de Contas.
         */
        put: operations["editar_prestacao_contas_painel_prestacao_contas__item_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/resumo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Resumo */
        get: operations["resumo_painel_resumo_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/serie": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Serie */
        get: operations["serie_painel_serie_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/tomada-contas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Tomada Contas
         * @description Consulta os registros da aba Tomada de Contas da planilha.
         */
        get: operations["tomada_contas_painel_tomada_contas_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/painel/tomada-contas/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Editar Tomada Contas
         * @description Atualiza um registro da aba Tomada de Contas.
         */
        put: operations["editar_tomada_contas_painel_tomada_contas__item_id__put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Cobertura */
        Cobertura: {
            total_siafe: components["schemas"]["Saldos"];
            vinculado: components["schemas"]["Saldos"];
        };
        /** Contagem */
        Contagem: {
            /** Convenios */
            convenios: number;
            /** Valor */
            valor: string | null;
        };
        /** Contratual */
        Contratual: {
            /** A Repassar */
            a_repassar: number | null;
            /** Contrapartida */
            contrapartida: number | null;
            /** Execucao Pct */
            execucao_pct: number | null;
            /** Investido Estado */
            investido_estado: number | null;
            /** Investido Sobre Total Pct */
            investido_sobre_total_pct: number | null;
            /** Repasse Estado */
            repasse_estado: number | null;
            /** Valor Total */
            valor_total: number | null;
        };
        /** ContratualRecorte */
        ContratualRecorte: {
            /** A Repassar */
            a_repassar: number | null;
            /** Contrapartida */
            contrapartida: number | null;
            /** Execucao Pct */
            execucao_pct: number | null;
            /** Investido Estado */
            investido_estado: number | null;
            /** Investido Sobre Total Pct */
            investido_sobre_total_pct: number | null;
            /**
             * Recorte
             * @enum {string}
             */
            recorte: "31" | "89";
            /** Repasse Estado */
            repasse_estado: number | null;
            /** Valor Total */
            valor_total: number | null;
        };
        /** ConvenioCompartilhado */
        ConvenioCompartilhado: {
            /** Codigo */
            codigo: string;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
        };
        /** Convenios */
        Convenios: {
            /** Ano */
            ano: number;
            /** Itens */
            itens: components["schemas"]["LinhaConvenio"][];
            /** Mes */
            mes: number;
            /** Municipios */
            municipios: string[];
            /** Pagina */
            pagina: number;
            /**
             * Recorte
             * @enum {string}
             */
            recorte: "31" | "89" | "342";
            /** Tamanho */
            tamanho: number;
            /** Total */
            total: number;
        };
        /** Credenciais */
        Credenciais: {
            /** Email */
            email: string;
            /** Senha */
            senha: string;
        };
        /** DetalheConvenio */
        DetalheConvenio: {
            /** Codigo Compartilhado */
            codigo_compartilhado: boolean;
            /** Codigo Seiop */
            codigo_seiop: string | null;
            /** Codigo Seobras */
            codigo_seobras: string | null;
            /** Compartilhado Com */
            compartilhado_com: components["schemas"]["ConvenioCompartilhado"][];
            /** Contratual */
            contratual: components["schemas"]["ContratualRecorte"][];
            /** Fase */
            fase: string;
            mes_anterior: components["schemas"]["Saldos"] | null;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
            /** Objeto */
            objeto: string | null;
            /**
             * Prestacao Contas
             * @default []
             */
            prestacao_contas: components["schemas"]["LinhaPrestacaoContas"][];
            /** Recortes */
            recortes: ("31" | "89" | "342")[];
            referencia: components["schemas"]["Mes"];
            saldos: components["schemas"]["Saldos"] | null;
            /** Serie */
            serie: components["schemas"]["PontoSerie"][];
            /** Situacao Vigencia */
            situacao_vigencia: string | null;
            /** Status */
            status: string | null;
            tomada_contas?: components["schemas"]["LinhaTomadaContas"] | null;
            /** Vigencia Final */
            vigencia_final: string | null;
        };
        /** EdicaoConvenioPayload */
        EdicaoConvenioPayload: {
            /** A Aprovar */
            a_aprovar?: number | null;
            /** A Comprovar */
            a_comprovar?: number | null;
            /** A Pagar */
            a_pagar?: number | null;
            /** A Repassar */
            a_repassar?: number | null;
            /** Aprovados */
            aprovados?: number | null;
            /** Codigo Seiop */
            codigo_seiop?: string | null;
            /** Codigo Seobras */
            codigo_seobras?: string | null;
            /** Contrapartida */
            contrapartida?: number | null;
            /** Fase */
            fase?: string | null;
            /** Investido Estado */
            investido_estado?: number | null;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
            /** Repasse Estado */
            repasse_estado?: number | null;
            /** Status */
            status?: string | null;
            /** Valor Total */
            valor_total?: number | null;
        };
        /** EdicaoMunicipioPayload */
        EdicaoMunicipioPayload: {
            /** A Aprovar */
            a_aprovar?: number | null;
            /** A Comprovar */
            a_comprovar?: number | null;
            /** A Pagar */
            a_pagar?: number | null;
            /** A Repassar */
            a_repassar?: number | null;
            /** Aprovados */
            aprovados?: number | null;
            /** Contrapartida */
            contrapartida?: number | null;
            /** Convenios */
            convenios?: number | null;
            /** Investido Estado */
            investido_estado?: number | null;
            /** Municipio */
            municipio: string;
            /** Repasse Estado */
            repasse_estado?: number | null;
            /** Valor Total */
            valor_total?: number | null;
        };
        /** EdicaoPrestacaoContasPayload */
        EdicaoPrestacaoContasPayload: {
            /** Baixa Apresentacao */
            baixa_apresentacao?: string | null;
            /** Baixa Aprovacao */
            baixa_aprovacao?: string | null;
            /** Cnpj */
            cnpj?: string | null;
            /** Codigo Seiop */
            codigo_seiop?: string | null;
            /** Codigo Seobras */
            codigo_seobras?: string | null;
            /** Municipio */
            municipio?: string | null;
            /** Numero Convenio */
            numero_convenio?: string | null;
            /** Observacao */
            observacao?: string | null;
            /** Parcela */
            parcela?: number | null;
            /** Processo */
            processo?: string | null;
            /** Situacao */
            situacao?: string | null;
            /** Valor Executado */
            valor_executado?: number | null;
            /** Valor Repasse */
            valor_repasse?: number | null;
        };
        /** EdicaoTomadaContasPayload */
        EdicaoTomadaContasPayload: {
            /** Codigo Seobras */
            codigo_seobras?: string | null;
            /** Municipio */
            municipio?: string | null;
            /** Numero Convenio */
            numero_convenio?: string | null;
            /** Objeto */
            objeto?: string | null;
            /** Parecer Comissao */
            parecer_comissao?: string | null;
            /** Processo Sei */
            processo_sei?: string | null;
            /** Status */
            status?: string | null;
            /** Valor Siafe */
            valor_siafe?: number | null;
        };
        /** ExecucaoIniciada */
        ExecucaoIniciada: {
            /** Execucao Id */
            execucao_id: number;
            /** Status */
            status: string;
        };
        /** ExecucaoStatus */
        ExecucaoStatus: {
            /** Erro */
            erro: string | null;
            /** Fim */
            fim: string | null;
            /** Id */
            id: number;
            /**
             * Inicio
             * Format: date-time
             */
            inicio: string;
            /** Origem */
            origem: string;
            /** Registros */
            registros: number | null;
            /** Status */
            status: string;
        };
        /** Execucoes */
        Execucoes: {
            /** Itens */
            itens: components["schemas"]["ExecucaoStatus"][];
            /** Pagina */
            pagina: number;
            /** Tamanho */
            tamanho: number;
            /** Total */
            total: number;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** LinhaConvenio */
        LinhaConvenio: {
            /** A Aprovar */
            a_aprovar: number | null;
            /** A Comprovar */
            a_comprovar: number | null;
            /** A Pagar */
            a_pagar: number | null;
            /** A Repassar */
            a_repassar: number | null;
            /** Aprovados */
            aprovados: number | null;
            /** Codigo Compartilhado */
            codigo_compartilhado: boolean;
            /** Codigo Seiop */
            codigo_seiop: string | null;
            /** Codigo Seobras */
            codigo_seobras: string | null;
            /** Contrapartida */
            contrapartida: number | null;
            /** Execucao Pct */
            execucao_pct: number | null;
            /** Fase */
            fase: string;
            /** Investido Estado */
            investido_estado: number | null;
            /** Investido Sobre Total Pct */
            investido_sobre_total_pct: number | null;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
            /** Repasse Estado */
            repasse_estado: number | null;
            /** Status */
            status: string | null;
            /** Valor Total */
            valor_total: number | null;
        };
        /** LinhaMunicipio */
        LinhaMunicipio: {
            /** A Aprovar */
            a_aprovar: number | null;
            /** A Comprovar */
            a_comprovar: number | null;
            /** A Pagar */
            a_pagar: number | null;
            /** A Repassar */
            a_repassar: number | null;
            /** Aprovados */
            aprovados: number | null;
            /** Codigo Compartilhado */
            codigo_compartilhado: boolean;
            /** Contrapartida */
            contrapartida: number | null;
            /** Convenios */
            convenios: number;
            /** Execucao Pct */
            execucao_pct: number | null;
            /** Investido Estado */
            investido_estado: number | null;
            /** Investido Sobre Total Pct */
            investido_sobre_total_pct: number | null;
            /** Municipio */
            municipio: string;
            /** Repasse Estado */
            repasse_estado: number | null;
            /** Valor Total */
            valor_total: number | null;
        };
        /** LinhaPrestacaoContas */
        LinhaPrestacaoContas: {
            /** Baixa Apresentacao */
            baixa_apresentacao: string | null;
            /** Baixa Aprovacao */
            baixa_aprovacao: string | null;
            /** Cnpj */
            cnpj: string | null;
            /** Codigo Seiop */
            codigo_seiop: string | null;
            /** Codigo Seobras */
            codigo_seobras: string | null;
            /** Id */
            id: number;
            /** Item */
            item: number | null;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
            /** Observacao */
            observacao: string | null;
            /** Parcela */
            parcela: number | null;
            /** Processo */
            processo: string | null;
            /** Situacao */
            situacao: string | null;
            /** Valor Executado */
            valor_executado: number | null;
            /** Valor Repasse */
            valor_repasse: number | null;
        };
        /** LinhaTomadaContas */
        LinhaTomadaContas: {
            /** Codigo Seobras */
            codigo_seobras: string | null;
            /** Id */
            id: number;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
            /** Objeto */
            objeto: string | null;
            /** Parecer Comissao */
            parecer_comissao: string | null;
            /** Processo Sei */
            processo_sei: string | null;
            /** Status */
            status: string | null;
            /** Valor Siafe */
            valor_siafe: number | null;
        };
        /** Mes */
        Mes: {
            /** Ano */
            ano: number;
            /** Mes */
            mes: number;
        };
        /** Municipios */
        Municipios: {
            /** Ano */
            ano: number;
            /** Itens */
            itens: components["schemas"]["LinhaMunicipio"][];
            /** Mes */
            mes: number;
            /** Municipios */
            municipios: string[];
            /** Pagina */
            pagina: number;
            /**
             * Recorte
             * @enum {string}
             */
            recorte: "31" | "89" | "342";
            /** Tamanho */
            tamanho: number;
            /** Total */
            total: number;
        };
        /** NovoConvenioPayload */
        NovoConvenioPayload: {
            /**
             * A Aprovar
             * @default 0
             */
            a_aprovar: number | null;
            /**
             * A Comprovar
             * @default 0
             */
            a_comprovar: number | null;
            /**
             * A Pagar
             * @default 0
             */
            a_pagar: number | null;
            /** A Repassar */
            a_repassar?: number | null;
            /**
             * Aprovados
             * @default 0
             */
            aprovados: number | null;
            /** Baixa Apresentacao */
            baixa_apresentacao?: string | null;
            /** Baixa Aprovacao */
            baixa_aprovacao?: string | null;
            /** Cnpj */
            cnpj?: string | null;
            /** Codigo Seiop */
            codigo_seiop?: string | null;
            /** Codigo Seobras */
            codigo_seobras?: string | null;
            /**
             * Contrapartida
             * @default 0
             */
            contrapartida: number | null;
            /** Fase */
            fase?: string | null;
            /**
             * Incluir Prestacao
             * @default false
             */
            incluir_prestacao: boolean;
            /**
             * Incluir Tomada
             * @default false
             */
            incluir_tomada: boolean;
            /**
             * Investido Estado
             * @default 0
             */
            investido_estado: number | null;
            /** Municipio */
            municipio: string;
            /** Numero Convenio */
            numero_convenio: string;
            /** Objeto */
            objeto?: string | null;
            /**
             * Parcela
             * @default 1
             */
            parcela: number | null;
            /** Parecer Comissao */
            parecer_comissao?: string | null;
            /** Processo Sei */
            processo_sei?: string | null;
            /**
             * Recortes
             * @default [
             *       "31",
             *       "89",
             *       "342"
             *     ]
             */
            recortes: string[];
            /**
             * Repasse Estado
             * @default 0
             */
            repasse_estado: number | null;
            /**
             * Situacao Vigencia
             * @default Vigente
             */
            situacao_vigencia: string | null;
            /**
             * Status
             * @default Em execução
             */
            status: string | null;
            /** Termo Realinhamento */
            termo_realinhamento?: string | null;
            /**
             * Valor Total
             * @default 0
             */
            valor_total: number | null;
            /** Vigencia Final */
            vigencia_final?: string | null;
            /** Vigencia Inicio */
            vigencia_inicio?: string | null;
        };
        /** PontoSerie */
        PontoSerie: {
            /** A Aprovar */
            a_aprovar: number | null;
            /** A Comprovar */
            a_comprovar: number | null;
            /** A Pagar */
            a_pagar: number | null;
            /** Ano */
            ano: number;
            /** Aprovados */
            aprovados: number | null;
            /** Mes */
            mes: number;
        };
        /** PrestacaoContasResposta */
        PrestacaoContasResposta: {
            /** Itens */
            itens: components["schemas"]["LinhaPrestacaoContas"][];
            /** Municipios */
            municipios: string[];
            /** Pagina */
            pagina: number;
            /** Tamanho */
            tamanho: number;
            /** Total */
            total: number;
        };
        /** Referencia */
        Referencia: {
            /** Ano */
            ano: number;
            /** Arquivo */
            arquivo: string | null;
            /** Mes */
            mes: number;
            /** Planilha Importada Em */
            planilha_importada_em: string | null;
            /** Posicao Siafe Em */
            posicao_siafe_em: string | null;
            ultimo_mes_disponivel: components["schemas"]["Mes"] | null;
        };
        /** Resumo */
        Resumo: {
            contratual: components["schemas"]["Contratual"] | null;
            /** Convenios */
            convenios: number;
            /** Municipios */
            municipios: string[];
            /**
             * Recorte
             * @enum {string}
             */
            recorte: "31" | "89" | "342";
            referencia: components["schemas"]["Referencia"];
            siafe: components["schemas"]["SiafeResumo"] | null;
            situacao: components["schemas"]["Situacao"] | null;
        };
        /** Saldos */
        Saldos: {
            /** A Aprovar */
            a_aprovar: number | null;
            /** A Comprovar */
            a_comprovar: number | null;
            /** A Pagar */
            a_pagar: number | null;
            /** Aprovados */
            aprovados: number | null;
        };
        /** Serie */
        Serie: {
            /** Municipios */
            municipios: string[];
            /** Pontos */
            pontos: components["schemas"]["PontoSerie"][];
            /**
             * Recorte
             * @enum {string}
             */
            recorte: "31" | "89" | "342";
        };
        /** SiafeResumo */
        SiafeResumo: {
            /** A Aprovar */
            a_aprovar: number | null;
            /** A Comprovar */
            a_comprovar: number | null;
            /** A Pagar */
            a_pagar: number | null;
            /** Aprovados */
            aprovados: number | null;
            cobertura: components["schemas"]["Cobertura"] | null;
            mes_anterior: components["schemas"]["Saldos"] | null;
        };
        /** Situacao */
        Situacao: {
            /** Situacao Vigencia */
            situacao_vigencia: components["schemas"]["Contagem"][];
            /** Status */
            status: components["schemas"]["Contagem"][];
        };
        /** TomadaContasResposta */
        TomadaContasResposta: {
            /** Itens */
            itens: components["schemas"]["LinhaTomadaContas"][];
            /** Municipios */
            municipios: string[];
            /** Pagina */
            pagina: number;
            /** Tamanho */
            tamanho: number;
            /** Total */
            total: number;
        };
        /** UsuarioPublico */
        UsuarioPublico: {
            /** Cargo */
            cargo: string | null;
            /** Email */
            email: string;
            /** Id */
            id: number;
            /** Nome */
            nome: string;
            /** Orgao */
            orgao: string | null;
            /** Perfil */
            perfil: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    login_auth_login_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Credenciais"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioPublico"];
                };
            };
            /** @description E-mail ou senha inválidos. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description Conta bloqueada */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    logout_auth_logout_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    me_auth_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsuarioPublico"];
                };
            };
            /** @description Sem sessão válida */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    disparar_carga_siafe_etl_siafe_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExecucaoIniciada"];
                };
            };
            /** @description Já existe uma carga em andamento */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    historico_cargas_siafe_etl_siafe_execucoes_get: {
        parameters: {
            query?: {
                /** @description A partir de 1 */
                pagina?: number;
                /** @description Itens por página */
                tamanho?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Execucoes"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    status_carga_siafe_etl_siafe_status_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExecucaoStatus"];
                };
            };
        };
    };
    convenio_painel_convenio_get: {
        parameters: {
            query: {
                /** @description Número do convênio, nas grafias aceitas pela carga (ex.: 143/14) */
                numero: string;
                /** @description Município do convênio (sem acento e caixa também valem) */
                municipio: string;
                ano?: number | null;
                mes?: number | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DetalheConvenio"];
                };
            };
            /** @description Nenhum convênio com essa chave */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    convenios_painel_convenios_get: {
        parameters: {
            query?: {
                /** @description 31 vigentes, 89 primeiro repasse, 342 histórico */
                recorte?: "31" | "89" | "342";
                /** @description Repetível; sem ele, todos */
                municipio?: string[] | null;
                ano?: number | null;
                mes?: number | null;
                /** @description A partir de 1 */
                pagina?: number;
                /** @description Itens por página */
                tamanho?: number;
                /** @description Campo, com `-` para decrescente. Aceitos: numero_convenio, municipio, status, fase, a_pagar, a_comprovar, a_aprovar, aprovados, valor_total, repasse_estado, contrapartida, investido_estado, a_repassar, execucao_pct, investido_sobre_total_pct */
                ordem?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Convenios"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    editar_convenio_painel_convenios_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EdicaoConvenioPayload"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinhaConvenio"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cadastrar_convenio_painel_convenios_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NovoConvenioPayload"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinhaConvenio"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    excluir_convenio_painel_convenios_delete: {
        parameters: {
            query: {
                /** @description Número do convênio. */
                numero: string;
                /** @description Município do convênio. */
                municipio: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    municipios_painel_municipios_get: {
        parameters: {
            query?: {
                /** @description 31 vigentes, 89 primeiro repasse, 342 histórico */
                recorte?: "31" | "89" | "342";
                /** @description Repetível; sem ele, todos */
                municipio?: string[] | null;
                ano?: number | null;
                mes?: number | null;
                /** @description A partir de 1 */
                pagina?: number;
                /** @description Itens por página */
                tamanho?: number;
                /** @description Campo, com `-` para decrescente. Aceitos: municipio, convenios, a_pagar, a_comprovar, a_aprovar, aprovados, valor_total, repasse_estado, contrapartida, investido_estado, a_repassar, execucao_pct, investido_sobre_total_pct */
                ordem?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Municipios"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    editar_municipio_painel_municipios_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EdicaoMunicipioPayload"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinhaMunicipio"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    prestacao_contas_painel_prestacao_contas_get: {
        parameters: {
            query?: {
                /** @description Filtrar por número do convênio */
                numero?: string | null;
                /** @description Busca textual */
                busca?: string | null;
                /** @description Repetível; sem ele, todos */
                municipio?: string[] | null;
                /** @description A partir de 1 */
                pagina?: number;
                /** @description Itens por página */
                tamanho?: number;
                /** @description Campo, com `-` para decrescente. Aceitos: municipio, numero_convenio, parcela, valor_repasse, valor_executado, situacao */
                ordem?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PrestacaoContasResposta"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    editar_prestacao_contas_painel_prestacao_contas__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EdicaoPrestacaoContasPayload"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinhaPrestacaoContas"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    resumo_painel_resumo_get: {
        parameters: {
            query?: {
                /** @description 31 vigentes, 89 primeiro repasse, 342 histórico */
                recorte?: "31" | "89" | "342";
                /** @description Repetível; sem ele, todos */
                municipio?: string[] | null;
                ano?: number | null;
                mes?: number | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Resumo"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    serie_painel_serie_get: {
        parameters: {
            query?: {
                /** @description 31 vigentes, 89 primeiro repasse, 342 histórico */
                recorte?: "31" | "89" | "342";
                /** @description Repetível; sem ele, todos */
                municipio?: string[] | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Serie"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    tomada_contas_painel_tomada_contas_get: {
        parameters: {
            query?: {
                /** @description Busca textual */
                busca?: string | null;
                /** @description Repetível; sem ele, todos */
                municipio?: string[] | null;
                /** @description A partir de 1 */
                pagina?: number;
                /** @description Itens por página */
                tamanho?: number;
                /** @description Campo, com `-` para decrescente. Aceitos: municipio, numero_convenio, codigo_seobras, valor_siafe, status */
                ordem?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TomadaContasResposta"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    editar_tomada_contas_painel_tomada_contas__item_id__put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                item_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EdicaoTomadaContasPayload"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinhaTomadaContas"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
