import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  insertOrUpdateBlock
} from '@blocknote/core';
import ReactCodeMirror from "@uiw/react-codemirror";
import { langs } from "@uiw/codemirror-extensions-langs";
import {
  BlockNoteView,
  darkDefaultTheme,
  lightDefaultTheme
} from '@blocknote/mantine';
import {
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote
} from '@blocknote/react';
import warnIcon from '@iconify/icons-mdi/alert';
import { Icon } from '@iconify/react/dist/iconify';
import { AnimatePresence, motion } from 'framer-motion';

import { deletePage, getPage, updatePage, uploadPhoto } from '../../api/Requests';
import { AuthContext } from '../../context/AuthContext';
import { ModalContext } from '../../context/ModalContext';
import { ThemeContext } from '../../context/ThemeContext';
import { handleError } from '../../utils/Common';
import { toastMessage } from '../../utils/Toast';
import Breadcrumb from '../Breadcrumb/Breadcrumb';
import DeleteModal from '../DeleteModal/DeleteModal';

import { Alert } from './EditorCustomTools';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './EditorCustomTool.css';

const TYPE ='procode';


const CodeBlock = createReactBlockSpec(
  {
    type: TYPE,
    propSchema: {
      code: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const [code, setCode] = useState(block.props.code || "");
      const lines = code.split('\n');
      const language = lines[0].trim() || "plain";
      const codeContent = lines.slice(1).join('\n');

      useEffect(() => {
        editor.updateBlock(block, {
          props: { code },
        });
      }, [code, block, editor]);

      const handleChange = (value) => {
        setCode(value);
      };

      console.log(language, "Here")

      return (
        <ReactCodeMirror
          value={code}
          onChange={handleChange}
          style={{ width: "100%", resize: "vertical" }}
          extensions={[langs["javascript"]()]}
          theme="dark"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
          }}
          width='100%'
          height='200px'
        />
      );
    },
    toExternalHTML: ({ block }) => {
      return (
        <pre>
          <code>{block?.props?.data}</code>
        </pre>
      );
    },
  }
);

const insertCode = (language) => ({
  title: "Code",
  group: "Other",
  onItemClick: (editor) => {
    console.log(language, "HEEEEEEEEEEEEEEEEEEEEEEEEEE")
    insertOrUpdateBlock(editor, {
      //@ts-ignore
      type: TYPE,
      propSchema: {
        data: {
          //@ts-ignore
          language: language,
          code: "",
        },
        content: "none",
      },
    });
  },
  aliases: ["code"],
  icon: 'fh',
  subtext: "Insert a code block.",
});


const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    alert: Alert,
    procode:CodeBlock,
  }
});

const insertAlert = (editor) => ({
  title: 'alert',
  subtext: 'This is a notification alert.',
  onItemClick: () => {
    editor.insertBlocks(
      [{ type: 'alert' }],
      editor.getTextCursorPosition().block,
      'after'
    );
  },
  aliases: [
    'alert',
    'notification',
    'emphasize',
    'warning',
    'error',
    'info',
    'success'
  ],
  group: 'Alert',
  icon: <Icon icon={warnIcon} />
});

function getTextContent(blocks) {
  for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block.content && Array.isArray(block.content) && block.content.length > 0) {
          return block.content.reduce((text, contentItem) => {
              if (contentItem.type === 'text') {
                  return text + (contentItem.text || '');
              }
              return text;
          }, '');
      }
  }
  return '';
}
const backtickInputRegex = /^```([a-z]*)[\s\n]?/;


const handleBacktickInput = (editor) => {
  console.log(editor, "editor in handleBacktick")
  const { previousBlock, currentBlock } = editor.getTextCursorPosition();
  
  if (currentBlock.content[0]?.text === '```') {
    const newBlock = editor.createBlock({
      type: TYPE,
      props: { code: 'plain\n' },
    });
    editor.insertBlocks([newBlock], currentBlock, 'after');
    editor.removeBlocks([currentBlock]);
    return true;
  }
  
  return false;
};

const EditorWrapper = React.memo(({ editor, theme }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (editor) {
      setIsReady(true);
    }
  }, [editor]);

  const [insertCodeLang, setInsertCodeLang] = useState(null);

  const handleChange = (value) => {
    let testString = getTextContent(value.document);
    const match = testString.match(backtickInputRegex);
    
    if (match) {
      const language = match[1];
      console.log('language', language);
      setInsertCodeLang(language);
    } else {
      console.log('No match found');
      setInsertCodeLang(null);
    }
  };
  useEffect(() => {
      console.log(editor)

      const handleKeyPress = (event, editor) => {
        console.log(editor, "in handle key")
        if (event.key === 'Enter') {
          const handled = handleBacktickInput(editor);
          if (handled) {
            event.preventDefault();
          }
        }
      };

      window.addEventListener('keydown', handleKeyPress, function(e) {
        console.log(editor, "editor in evet listener")
        handleKeyPress(e, editor)
      })

      return () => {
        window.removeEventListener('keydown', handleKeyPress, function(e) {
          handleKeyPress(e, editor)
        })
      };
  }, [insertCodeLang, editor]);

  if (!isReady) {
    return <div>Loading editor...</div>;
  }

  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      placeholder="Start typing..."
      className="pt-1.5"
      slashMenu={false}
      onChange={handleChange}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [...getDefaultReactSlashMenuItems(editor), insertAlert(editor), insertCode()],
            query
          )
        }
      />
    </BlockNoteView>
  );
});

export default function EditPage () {
  const { t } = useTranslation();
  const { darkMode } = useContext(ThemeContext);
  const [themeKey, setThemeKey] = useState(0);
  const { openModal, closeModal, deleteModal } = useContext(ModalContext);

  useEffect(() => {
    setThemeKey((prev) => prev + 1);
  }, [darkMode]);

  const [searchParams] = useSearchParams();
  const docId = searchParams.get('id');
  const dir = searchParams.get('dir');
  const pageId = searchParams.get('pageId');
  const pageGroupId = searchParams.get('pageGroupId');
  const version = searchParams.get('version');
  const { refreshData } = useContext(AuthContext);

  const navigate = useNavigate();
  const [pageData, setPageData] = useState({
    title: '',
    slug: '',
    content: {},
    isIntroPage: false
  });
  const [editorContent, setEditorContent] = useState([
    { type: 'paragraph', content: '' }
  ]);
  const generateSlug = (title) => {
    return '/' + title
      .toLowerCase()
      .trim()
      .replace(/[\s]+/g, '-')
      .replace(/[^\w-]+/g, '');
  };
  const updateContent = (newContent, name) => {
    setPageData((prevPageData) => {
      const updatedPageData = { ...prevPageData, [name]: newContent };
      if (name === 'title') {
        updatedPageData.slug = generateSlug(newContent);
      }

      return updatedPageData;
    });
  };

  const editor = useCreateBlockNote({
    schema,
    initialContent: editorContent,
    uploadFile: async (file) => {
      const formData = new FormData();
      formData.append('upload', file);
      const result = await uploadPhoto(formData);

      if (result?.status === 'success') {
        if (result.data.photo) {
          return result.data.photo;
        }
      }
    }
  });

  const parsedContent = useCallback(
    (data) => {
      try {
        return JSON.parse(data);
      } catch (e) {
        toastMessage(t('error_parsing_page_content'), 'error');
        return {};
      }
    },
    [t]
  );

  useEffect(() => {
    const fetchData = async () => {
      const result = await getPage(Number(pageId));
      if (handleError(result, navigate, t)) return;

      if (result.status === 'success') {
        setPageData((prev) => ({
          ...prev,
          title: result.data.title || '',
          slug: result.data.slug || '',
          isIntroPage: result.data.isIntroPage || false
        }));
        const parsed = parsedContent(result.data.content);
        setEditorContent(parsed.length > 0 ? parsed : []);
      }
    };

    fetchData();
  }, [pageId, navigate, editor, t, parsedContent]);

  useEffect(() => {
    if (editor && editorContent.length > 0) {
      editor.replaceBlocks(editor.document, editorContent);
    }
  }, [editor, editorContent]);

  const handleEdit = useCallback(async () => {
    
    const result = await updatePage({
      title: pageData?.title,
      slug: pageData?.slug,
      content: JSON.stringify(editor.document),
      id: Number(pageId)
    });

    if (handleError(result, navigate, t)) {
      return;
    }

    if (result.status === 'success') {
      toastMessage(t(result.data.message), 'success');
      refreshData();
    }
  }, [pageData, editor, pageId, navigate, t, refreshData]);

  const handleDelete = async () => {
    const result = await deletePage(Number(pageId));

    if (handleError(result, navigate, t)) {
      return;
    }

    if (result.status === 'success') {
      closeModal('delete');
      toastMessage(t(result.data.message), 'success');
      refreshData();

      if (dir === 'true') {
        navigate(`/dashboard/documentation?id=${docId}`);
      } else {
        navigate(
          `/dashboard/documentation/page-group?id=${docId}&pageGroupId=${pageGroupId}&versionId=${docId}&version=${version}`
        );
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        handleEdit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleEdit]);

  const lightTheme = {
    colors: {
      editor: {
        text: '#222222',
        background: '#ffffff'
      },
      menu: {
        text: '#222222',
        background: '#ffffff'
      },
      tooltip: {
        text: '#222222',
        background: '#ffffff'
      },
      hovered: {
        text: '#222222',
        background: '#e3e3e3'
      },
      selected: {
        text: '#222222',
        background: '#b8b9ba'
      },
      disabled: {
        text: '#222222',
        background: '#b8b9ba'
      },
      shadow: '#000000',
      border: '#e3e3e3',
      sideMenu: '#222222',
      highlights: lightDefaultTheme.colors.highlights
    },
    borderRadius: 4,
    fontFamily: 'Helvetica Neue, sans-serif',
    colorScheme: 'light'
  };

  const darkTheme = {
    colors: {
      editor: {
        text: '#ffffff',
        background: '#374151'
      },
      menu: {
        text: '#ffffff',
        background: '#374151'
      },
      tooltip: {
        text: '#ffffff',
        background: '#374151'
      },
      hovered: {
        text: '#ffffff',
        background: '#111827'
      },
      selected: {
        text: '#ffffff',
        background: '#111827'
      },
      disabled: {
        text: '#6b7280',
        background: '#4b5563'
      },
      shadow: '#000000',
      border: '#222222',
      sideMenu: '#f3f4f6',
      highlights: darkDefaultTheme.colors.highlights
    },
    borderRadius: 4,
    fontFamily: 'Helvetica Neue, sans-serif',
    colorScheme: 'dark'
  };

  const blueTheme = {
    light: lightTheme,
    dark: darkTheme
  };

  return (
    <AnimatePresence>
      {deleteModal && (
        <DeleteModal
          deleteDoc={handleDelete}
          id={pageData.id}
          message={`You.re permanently deleting "${pageData.title}"`}
          key="delete-page"
        />
      )}

      <Breadcrumb />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.1 }}
        id="defaultModal"
        tabIndex="-1"
        aria-hidden="true"
        className="flex  items-center w-full md:inset-0 h-modal md:h-full"
        key="edit-page-1"
      >
        <div className="w-full h-full md:h-auto">
          <div className="relative p-4 dark:bg-gray-800 rounded-lg sm:p-5">
            <div className="flex justify-start items-center pb-4 mb-4 rounded-t border-b sm:mb-5 dark:border-gray-600">
              <h3 className="text-2xl  font-semibold text-gray-900 dark:text-white">
                {t('edit_page')}
              </h3>
            </div>

            <div className="grid gap-4 mb-4 grid-cols-1">
              <div>
                <div className="mb-4">
                  <span className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                    {t('title')}
                  </span>
                  <input
                    type="text"
                    required
                    value={pageData.title}
                    onChange={(e) =>
                      updateContent(e.target.value, e.target.name)
                    }
                    name="title"
                    id="title"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                    placeholder={t('title_page_placeholder')}
                  />
                </div>

                <div>
                  <span className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                    {t('slug')}
                  </span>
                  <input
                    type="text"
                    required
                    value={pageData.slug}
                    onChange={(e) =>
                      updateContent(e.target.value, e.target.name)
                    }
                    name="slug"
                    id="slug"
                    disabled={pageData.isIntroPage}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                    placeholder={t('slug_placeholder')}
                  />
                </div>
              </div>

              <div>
                <span className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                  {t('content')}
                </span>

                {editor && (
                  <EditorWrapper
                    key={themeKey}
                    editor={editor}
                    theme={darkMode ? blueTheme.dark : blueTheme.light}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-center gap-5">
              <button
                onClick={handleEdit}
                type="submit"
                className="text-white inline-flex gap-1 items-center bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:focus:ring-yellow-800 focus:ring-4 focus:outline-none focus:ring-yellow-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              >
                <Icon
                  icon="ri:edit-fill"
                  className="w-5 h-5 text-white dark:text-white"
                />
                {t('edit')}
              </button>

              {!pageData.isIntroPage && (
                <button
                  onClick={() => {
                    openModal('delete');
                  }}
                  className="inline-flex items-center gap-1 bg-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 dark:focus:ring-red-900 text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                >
                  <Icon icon="material-symbols:delete" className="w-5 h-5" />
                  {t('delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
