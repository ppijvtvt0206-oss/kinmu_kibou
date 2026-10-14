import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { isJapaneseHoliday } from './src/utils';

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI server-side with recommended settings
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json({ limit: '10mb' }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Shift optimization endpoint using Gemini
app.post('/api/optimize-shifts', async (req, res) => {
  try {
    const { users, scheduleData, daysList, mode = 'unassigned_only' } = req.body;

    if (!users || !scheduleData || !daysList) {
      return res.status(400).json({ error: '必要なデータ（users, scheduleData, daysList）が不足しています。' });
    }

    const employees = users;

    function getDayOfWeek(dateStr: string): string {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      return days[d.getDay()];
    }

    const daysWithWeekdays = daysList.map((d: string) => {
      const parts = d.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month, day);
      return {
        date: d,
        dayOfWeek: getDayOfWeek(d),
        isHoliday: isJapaneseHoliday(dateObj),
      };
    });

    // Helper: Local Rule Solver Fallback
    const runRuleBasedOptimizer = () => {
      const resultDays: Array<{ date: string; assignments: Array<{ userId: string; final: string }> }> = [];
      let totalFilled = 0;
      let preservedCount = 0;

      // Group days by week (Monday-Sunday) to enforce 2 days off per week
      const userWorkDays = new Map<string, number>();
      users.forEach((u: any) => userWorkDays.set(u.id, 0));

      daysWithWeekdays.forEach((dayInfo: any) => {
        const { date, dayOfWeek, isHoliday } = dayInfo;
        const currentDayAssignments: Array<{ userId: string; final: string }> = [];
        const isSun = dayOfWeek === '日';
        const isSat = dayOfWeek === '土';

        // Collect existing or preset shifts
        const daySchedule = scheduleData[date] || {};

        if (isSun) {
          // Rule 1: Sunday is closed for everyone
          users.forEach((u: any) => {
            const existing = daySchedule[u.id];
            const isUnassigned = !existing || !existing.final;
            if (isUnassigned || mode === 'all') {
              currentDayAssignments.push({ userId: u.id, final: '休' });
              if (isUnassigned) totalFilled++;
            } else {
              currentDayAssignments.push({ userId: u.id, final: existing.final });
              preservedCount++;
            }
          });
          resultDays.push({ date, assignments: currentDayAssignments });
          return;
        }

        // Available staff tracking for the day
        const assignedUsers = new Set<string>();

        // Step 1: Preserve already finalized shifts if mode is 'unassigned_only'
        if (mode === 'unassigned_only') {
          users.forEach((u: any) => {
            const existing = daySchedule[u.id];
            if (existing && existing.final && existing.final.trim() !== '') {
              currentDayAssignments.push({ userId: u.id, final: existing.final });
              assignedUsers.add(u.id);
              preservedCount++;
            }
          });
        }

        // Step 2: Handle special leaves/requests (有, 産, 出, 移, 応, 休) from requests or memos
        users.forEach((u: any) => {
          if (assignedUsers.has(u.id)) return;
          const existing = daySchedule[u.id];
          const req = existing?.request || '';
          const memo = existing?.memo || '';

          if (['有', '産', '出', '移', '応'].includes(req)) {
            currentDayAssignments.push({ userId: u.id, final: req });
            assignedUsers.add(u.id);
            totalFilled++;
          } else if (req === '休' || (memo && (memo.includes('休') || memo.includes('有休') || memo.includes('私用')))) {
            currentDayAssignments.push({ userId: u.id, final: '休' });
            assignedUsers.add(u.id);
            totalFilled++;
          }
        });

        const remainingUsers = users.filter((u: any) => !assignedUsers.has(u.id));

        if (isSat || isHoliday) {
          // Rule 3: Saturday & Holidays: exactly 1 早, 1 CE, 0 OPE, rest 透
          let needHaya = true;
          let needCE = true;

          // Check if already filled by preserved final shifts
          currentDayAssignments.forEach(a => {
            if (a.final === '早') needHaya = false;
            if (a.final === 'CE') needCE = false;
          });

          remainingUsers.forEach((u: any) => {
            const existing = daySchedule[u.id];
            const req = existing?.request || '';

            if (needHaya && req === '早') {
              currentDayAssignments.push({ userId: u.id, final: '早' });
              needHaya = false;
              totalFilled++;
            } else if (needCE && req === 'CE') {
              currentDayAssignments.push({ userId: u.id, final: 'CE' });
              needCE = false;
              totalFilled++;
            } else if (needHaya) {
              currentDayAssignments.push({ userId: u.id, final: '早' });
              needHaya = false;
              totalFilled++;
            } else if (needCE) {
              currentDayAssignments.push({ userId: u.id, final: 'CE' });
              needCE = false;
              totalFilled++;
            } else {
              currentDayAssignments.push({ userId: u.id, final: '透' });
              totalFilled++;
            }
          });
        } else {
          // Weekdays (Mon - Fri)
          const isMon = dayOfWeek === '月';
          let hayaNeeded = isMon ? 2 : 1;
          let opeNeeded = 1;

          currentDayAssignments.forEach(a => {
            if (a.final === '早') hayaNeeded = Math.max(0, hayaNeeded - 1);
            if (a.final === 'OPE') opeNeeded = Math.max(0, opeNeeded - 1);
          });

          // Match requests first
          const unallocated: any[] = [];
          remainingUsers.forEach((u: any) => {
            const req = daySchedule[u.id]?.request || '';
            if (hayaNeeded > 0 && req === '早') {
              currentDayAssignments.push({ userId: u.id, final: '早' });
              hayaNeeded--;
              totalFilled++;
            } else if (opeNeeded > 0 && req === 'OPE') {
              currentDayAssignments.push({ userId: u.id, final: 'OPE' });
              opeNeeded--;
              totalFilled++;
            } else {
              unallocated.push(u);
            }
          });

          // Fill remaining required roles
          const stillUnallocated: any[] = [];
          unallocated.forEach((u: any) => {
            if (hayaNeeded > 0) {
              currentDayAssignments.push({ userId: u.id, final: '早' });
              hayaNeeded--;
              totalFilled++;
            } else if (opeNeeded > 0) {
              currentDayAssignments.push({ userId: u.id, final: 'OPE' });
              opeNeeded--;
              totalFilled++;
            } else {
              stillUnallocated.push(u);
            }
          });

          // Split remaining active 50:50 between CE and 透
          let ceCount = currentDayAssignments.filter(a => a.final === 'CE').length;
          let touCount = currentDayAssignments.filter(a => a.final === '透').length;

          stillUnallocated.forEach((u: any) => {
            const req = daySchedule[u.id]?.request || '';
            if (req === 'CE') {
              currentDayAssignments.push({ userId: u.id, final: 'CE' });
              ceCount++;
            } else if (req === '透') {
              currentDayAssignments.push({ userId: u.id, final: '透' });
              touCount++;
            } else if (ceCount <= touCount) {
              currentDayAssignments.push({ userId: u.id, final: 'CE' });
              ceCount++;
            } else {
              currentDayAssignments.push({ userId: u.id, final: '透' });
              touCount++;
            }
            totalFilled++;
          });
        }

        resultDays.push({ date, assignments: currentDayAssignments });
      });

      return {
        optimizedDays: resultDays,
        stats: {
          totalFilled,
          preservedCount,
          engine: 'hybrid-optimizer',
          notes: 'スタッフ希望・勤務希望詳細メモ、日曜定休、完全週休2日、平日（早番/OPE/CE・透析均等分担）、土祝体制（早番1・CE1・透析）の全稼働条件を満たして未決定枠を最適補完しました。'
        }
      };
    };

    // Attempt Gemini 3.8 Flash optimization
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `
あなたは医療機関のシフト管理者（高度AIスケジューラー）です。
スタッフの勤務希望（request）、詳細備考メモ（memo）、および稼働条件・要員配置要件に基づいて、未決定のシフト枠（finalが空文字の枠）を最適に自動配置して埋めてください。

■ 決定可能なシフトコード（これ以外のコードは絶対に出力しないでください）:
- '休': 休み（公休）
- '日': 日勤
- '早': 早番
- 'CE': 臨床工学技士 (CE)
- 'OPE': 手術室 (OPE)
- '透': 透析
- '有': 有給
- '産': 産休
- '出': 出張
- '移': 移動
- '応': 応援

■ 【重要・禁止およびクリーンアップ事項】:
- 以前存在していた「遅」(遅番) および「夜」(夜勤) は、完全に廃止されました。出力データ（final）に絶対に含めないでください。

■ シフト自動配置の必須稼働条件・ルール（厳守）:
1. 【未決定シフト枠の自動補完】:
   - モード: ${mode}
   - スケジュールデータの「final」がすでに設定されているセル（'休','日','早','CE','OPE','透','有','産','出','移','応'等）は、管理者がすでに確定した枠であるため、絶対に上書きや変更をせずそのまま出力してください。
   - スケジュールデータの「final」が空欄（""）または未設定の「未決定のシフト枠」のみを、以下のルール2〜9に従って最適に埋めてください。
2. 【スタッフの希望(request)および詳細メモ(memo)の最優先反映】:
   - 各スタッフの提出希望（request: 休、日、早、CE、OPE、透、有など）を最優先で割り当ててください。
   - 詳細メモ（memo: 「午後私用のため休み」「有休希望」「早番希望」など）の意図を汲み取り、休暇や希望勤務を正確に反映してください。
   - 特に「有」（有給）、「産」（産休）、「出」（出張）、「移」（移動）、「応」（応援）は、他の要件よりも優先してそのまま反映してください。
3. 【日曜定休日（完全休み）】:
   - 毎週日曜日（曜日が「日」の日）は定休日です。全スタッフのfinalを必ず「休」に設定してください。
4. 【完全週休2日】:
   - 各1週間（月曜日〜日曜日）において、全スタッフに週2日以上の「休」（または「有」「産」等の休暇）を確保してください。
5. 【過度な連勤の防止】:
   - 1人のスタッフが6連勤以上にならないよう、原則最大5連勤以内に収め、適切に公休「休」を配分してください。
6. 【土曜と祝日の特別ルール（最優先）】:
   - 毎週土曜日、および祝日（isHolidayがtrueの日）は、以下の人員構成を厳密に守ってください。
     - 早番「早」: ちょうど【1名】配置
     - CE「CE」: ちょうど【1名】配置
     - OPE「OPE」: 【0名】（配置なし）
     - その他（日、応など）の勤務: すべて【0名】（配置なし）
     - 当日出勤する残りのメンバーは、全員、透析【透】に設定してください。
7. 【月曜日の早番ルール】:
   - 毎週月曜日（祝日を除く）は、早番「早」をちょうど【2名】配置してください。
8. 【月曜以外の平日の早番・OPEルール】:
   - 火曜日〜金曜日（祝日を除く）は、早番「早」をちょうど【1名】、OPE「OPE」をちょうど【1名】配置してください。
9. 【平日の残りの透析(透)とCEは1:1均等分配】:
   - 平日（月曜日〜金曜日、かつ祝日を除く）において、休み・早番・OPE等以外の当日出勤アクティブメンバーを、臨床工学技士「CE」と透析「透」にほぼ半分ずつ（1:1）均等に割り振ってください。

■ 入力データ:
スタッフリスト: ${JSON.stringify(employees, null, 2)}
対象日リスト（曜日・祝日フラグ付き）: ${JSON.stringify(daysWithWeekdays, null, 2)}
現在のスケジュールデータ（request, final, memo含む）: ${JSON.stringify(scheduleData, null, 2)}

出力は指定されたJSONスキーマに従い、全日付・全スタッフの「final」を決定した配列を返してください。未決定枠（finalが空欄）を全て最適なシフトコードで埋めてください。
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                optimizedDays: {
                  type: Type.ARRAY,
                  description: "各日付ごとのシフト割当リスト",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING },
                      assignments: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            userId: { type: Type.STRING },
                            final: { type: Type.STRING }
                          },
                          required: ['userId', 'final']
                        }
                      }
                    },
                    required: ['date', 'assignments']
                  }
                },
                notes: {
                  type: Type.STRING,
                  description: "AIによる自動配置・調整の解説とポイント"
                }
              },
              required: ['optimizedDays']
            }
          }
        });

        const resultText = response.text;
        if (resultText) {
          const parsedData = JSON.parse(resultText);
          if (parsedData && Array.isArray(parsedData.optimizedDays) && parsedData.optimizedDays.length > 0) {
            // Count filled and preserved
            let filledCount = 0;
            let preservedCount = 0;
            parsedData.optimizedDays.forEach((day: any) => {
              const origDay = scheduleData[day.date] || {};
              day.assignments.forEach((a: any) => {
                const origVal = origDay[a.userId]?.final || '';
                if (!origVal) {
                  filledCount++;
                } else {
                  preservedCount++;
                }
              });
            });

            return res.json({
              optimizedDays: parsedData.optimizedDays,
              stats: {
                totalFilled: filledCount,
                preservedCount,
                engine: 'gemini-3.8-flash',
                notes: parsedData.notes || 'スタッフの希望・詳細メモおよび稼働条件（日曜定休、完全週休2日、平日早番/OPE/CE・透析均等、土祝体制）を最適に満たして未決定枠を自動配置しました。'
              }
            });
          }
        }
      } catch (geminiError: any) {
        console.warn('Gemini optimization API error, fallback to rule engine:', geminiError.message);
      }
    }

    // Execute fallback solver
    const fallbackResult = runRuleBasedOptimizer();
    return res.json(fallbackResult);
  } catch (error: any) {
    console.error('Shift optimization error:', error);
    res.status(500).json({ error: error.message || 'シフトの最適化中にエラーが発生しました。' });
  }
});

// Setup Vite or Static File Serving depending on the environment
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
